import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { firstValueFrom } from "rxjs";
import { Course, CourseDocument } from "./schemas/course.schema";

export interface CourseIndexingStatusReport {
  totalCourses: number;
  indexedWithChunks: number;
  missingChunks: number;
  missingCourseIds: string[];
  aiServiceUnreachable?: boolean;
  aiServiceMessage?: string;
}

/**
 * Triggers ai-service chunked embedding ({@link POST /upload-course-chunked}) without blocking HTTP handlers.
 */
@Injectable()
export class CourseIndexingService {
  private readonly logger = new Logger(CourseIndexingService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
  ) {}

  private aiBase(): string {
    return (process.env.AI_SERVICE_URL || "http://localhost:8000").replace(
      /\/$/,
      "",
    );
  }

  /**
   * Fire-and-forget reindex for one course. Safe to call after every course/subchapter save.
   */
  scheduleCourseReindex(courseId: string | undefined | null): void {
    const id = String(courseId ?? "").trim();
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      return;
    }
    setImmediate(() => {
      void this.requestChunkedUpload(id).catch((err: Error) =>
        this.logger.warn(
          `Background indexing failed for course ${id}: ${err?.message || err}`,
        ),
      );
    });
  }

  private async requestChunkedUpload(courseId: string): Promise<void> {
    const url = `${this.aiBase()}/upload-course-chunked`;
    await firstValueFrom(
      this.httpService.post(
        url,
        { course_id: courseId },
        { timeout: 600_000 },
      ),
    );
    this.logger.log(`Chunked embedding finished for course ${courseId}`);
  }

  /**
   * Compare Mongo course ids with Chroma chunk presence via ai-service GET /course-context/:id.
   */
  async getIndexingStatus(): Promise<CourseIndexingStatusReport> {
    const docs = await this.courseModel.find().select("_id").lean().exec();
    const ids = docs.map((d: { _id?: unknown }) => String(d._id));

    if (ids.length === 0) {
      return {
        totalCourses: 0,
        indexedWithChunks: 0,
        missingChunks: 0,
        missingCourseIds: [],
      };
    }

    const base = this.aiBase();
    let aiUnreachable = false;
    let aiMsg = "";
    const missing: string[] = [];
    let indexed = 0;
    const concurrency = 8;

    const checkOne = async (id: string): Promise<boolean> => {
      try {
        const { data } = await firstValueFrom(
          this.httpService.get(`${base}/course-context/${encodeURIComponent(id)}`, {
            params: { max_chunks: 5 },
            timeout: 45_000,
          }),
        );
        const n = Number((data as { chunk_count?: number })?.chunk_count ?? 0);
        return n > 0;
      } catch (e: unknown) {
        const err = e as { message?: string };
        aiUnreachable = true;
        aiMsg = String(err?.message || e);
        return false;
      }
    };

    for (let i = 0; i < ids.length; i += concurrency) {
      const slice = ids.slice(i, i + concurrency);
      const results = await Promise.all(slice.map((id) => checkOne(id)));
      slice.forEach((id, idx) => {
        if (results[idx]) {
          indexed += 1;
        } else {
          missing.push(id);
        }
      });
    }

    return {
      totalCourses: ids.length,
      indexedWithChunks: indexed,
      missingChunks: missing.length,
      missingCourseIds: missing,
      ...(aiUnreachable ? { aiServiceUnreachable: true, aiServiceMessage: aiMsg } : {}),
    };
  }
}
