import {
  BadRequestException,
  ParseIntPipe,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../users/schemas/user.schema";
import { SubjectsService } from "./subjects.service";
import { ModuleProgressService } from "./module-progress.service";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { UpdateSubjectDto } from "./dto/update-subject.dto";
import { AddChapterDto } from "./dto/add-chapter.dto";
import { AddChapterContentDto } from "./dto/add-chapter-content.dto";
import { AddSubChapterDto } from "./dto/add-subchapter.dto";
import { AddSubChapterContentDto } from "./dto/add-subchapter-content.dto";
import { UpdateSubChapterContentDto } from "./dto/update-subchapter-content.dto";
import { UpdateChapterContentDto } from "./dto/update-chapter-content.dto";
import { SubmitQuizDto } from "./dto/submit-quiz.dto";
import { SubmitQuizFileDto } from "./dto/submit-quiz-file.dto";
import { GradeQuizFileSubmissionDto } from "./dto/grade-quiz-file-submission.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, resolve } from "path";
import { existsSync, mkdirSync } from "fs";

const getUploadsDir = (...segments: string[]): string =>
  resolve(__dirname, "..", "..", "uploads", ...segments);

@ApiTags("subjects")
@Controller("subjects")
export class SubjectsController {
  constructor(
    private readonly subjectsService: SubjectsService,
    private readonly moduleProgressService: ModuleProgressService,
  ) {}

  @Post("upload-file")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Upload a cours file (pdf/doc/docx/ppt/pptx) or video (mp4) and return public URL",
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // Si type=video, stocker dans uploads/subjects/videos, sinon cours
          const type = req.query.type;
          const dir = getUploadsDir(
            "subjects",
            type === "video" ? "videos" : "cours",
          );
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const safeExt = extname(file.originalname || "").toLowerCase();
          const base = String(file.originalname || "file")
            .replace(/\.[^/.]+$/, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .slice(0, 80);
          cb(null, `${Date.now()}_${base}${safeExt || ""}`);
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 }, // 200MB pour les vidéos
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname || "").toLowerCase();
        const type = req.query.type;
        if (type === "video") {
          if (ext !== ".mp4") {
            cb(
              new BadRequestException(
                "Only MP4 files are allowed for video uploads",
              ) as any,
              false,
            );
            return;
          }
        } else {
          const allowed = [".pdf", ".doc", ".docx", ".ppt", ".pptx"];
          if (!allowed.includes(ext)) {
            cb(
              new BadRequestException(
                "Only PDF, Word, or PowerPoint files are allowed",
              ) as any,
              false,
            );
            return;
          }
        }
        cb(null, true);
      },
    }),
  )
  uploadCourseFile(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    const type = req?.query?.type;
    const protocol = String(req?.protocol || "http");
    const host = String(req?.get?.("host") || "localhost:3000");
    const relativePath = `/uploads/subjects/${type === "video" ? "videos" : "cours"}/${file.filename}`;

    return {
      status: "success",
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileUrl: `${protocol}://${host}${relativePath}`,
      path: relativePath,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a subject (instructor/admin only)" })
  create(@Body() createSubjectDto: CreateSubjectDto) {
    return this.subjectsService.create(createSubjectDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "List subjects (instructor/admin: optional instructor filter; student: subjects linked to their class)",
  })
  @ApiQuery({ name: "instructorId", required: false, type: String })
  findAll(@Query("instructorId") instructorId?: string, @Req() req?: any) {
    return this.subjectsService.findAll(instructorId, req?.user);
  }

  @Get(":id/learning-progress")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Aggregate learning progress for the current student (average module %, 70/25/5)",
  })
  async getSubjectLearningProgress(
    @Param("id") subjectId: string,
    @Req() req: any,
  ) {
    const studentId = req?.user?.id || req?.user?.userId || req?.user?._id;
    if (!studentId) {
      throw new BadRequestException("Student context required");
    }
    await this.subjectsService.ensureStudentHasSubjectAccess(
      String(studentId),
      subjectId,
    );
    return this.moduleProgressService.getSubjectAggregateProgressPercent(
      String(studentId),
      subjectId,
    );
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get a subject by ID" })
  findOne(@Param("id") id: string, @Req() req?: any) {
    return this.subjectsService.findOne(id, req?.user);
  }

  @Post(":id/chapters")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Append a chapter to a subject" })
  addChapter(@Param("id") id: string, @Body() addChapterDto: AddChapterDto) {
    return this.subjectsService.addChapter(id, addChapterDto);
  }

  @Delete(":id/chapters/:chapterOrder")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a chapter from a subject" })
  deleteChapter(
    @Param("id") id: string,
    @Param("chapterOrder", ParseIntPipe) chapterOrder: number,
  ) {
    return this.subjectsService.deleteChapter(id, chapterOrder);
  }

  @Post(":id/chapters/:chapterOrder/contents")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Attach content to a specific chapter" })
  addChapterContent(
    @Param("id") id: string,
    @Param("chapterOrder", ParseIntPipe) chapterOrder: number,
    @Body() addChapterContentDto: AddChapterContentDto,
  ) {
    return this.subjectsService.addChapterContent(
      id,
      chapterOrder,
      addChapterContentDto,
    );
  }

  @Put(":id/chapters/:chapterOrder/contents/:contentId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update content of a specific chapter" })
  updateChapterContent(
    @Param("id") id: string,
    @Param("chapterOrder", ParseIntPipe) chapterOrder: number,
    @Param("contentId") contentId: string,
    @Body() updateChapterContentDto: UpdateChapterContentDto,
  ) {
    return this.subjectsService.updateChapterContent(
      id,
      chapterOrder,
      contentId,
      updateChapterContentDto,
    );
  }

  @Delete(":id/chapters/:chapterOrder/contents/:contentId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a content item from a chapter" })
  deleteChapterContent(
    @Param("id") id: string,
    @Param("chapterOrder", ParseIntPipe) chapterOrder: number,
    @Param("contentId") contentId: string,
  ) {
    return this.subjectsService.deleteChapterContent(
      id,
      chapterOrder,
      contentId,
    );
  }

  // ==================== SubChapter Endpoints ====================

  @Post(":id/chapters/:chapterOrder/subchapters")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Append a subchapter to a specific chapter" })
  addSubChapter(
    @Param("id") id: string,
    @Param("chapterOrder", ParseIntPipe) chapterOrder: number,
    @Body() addSubChapterDto: AddSubChapterDto,
  ) {
    return this.subjectsService.addSubChapter(
      id,
      chapterOrder,
      addSubChapterDto,
    );
  }

  @Post(":id/chapters/:chapterOrder/subchapters/:subChapterOrder/contents")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Attach content to a specific subchapter",
  })
  addSubChapterContent(
    @Param("id") id: string,
    @Param("chapterOrder", ParseIntPipe) chapterOrder: number,
    @Param("subChapterOrder", ParseIntPipe) subChapterOrder: number,
    @Body() addSubChapterContentDto: AddSubChapterContentDto,
  ) {
    return this.subjectsService.addSubChapterContent(
      id,
      chapterOrder,
      subChapterOrder,
      addSubChapterContentDto,
    );
  }

  @Put(
    ":id/chapters/:chapterOrder/subchapters/:subChapterOrder/contents/:contentId",
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update content of a specific subchapter" })
  updateSubChapterContent(
    @Param("id") id: string,
    @Param("chapterOrder", ParseIntPipe) chapterOrder: number,
    @Param("subChapterOrder", ParseIntPipe) subChapterOrder: number,
    @Param("contentId") contentId: string,
    @Body() updateSubChapterContentDto: UpdateSubChapterContentDto,
  ) {
    return this.subjectsService.updateSubChapterContent(
      id,
      chapterOrder,
      subChapterOrder,
      contentId,
      updateSubChapterContentDto,
    );
  }

  @Delete(
    ":id/chapters/:chapterOrder/subchapters/:subChapterOrder/contents/:contentId",
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Delete a content item from a subchapter",
  })
  deleteSubChapterContent(
    @Param("id") id: string,
    @Param("chapterOrder", ParseIntPipe) chapterOrder: number,
    @Param("subChapterOrder", ParseIntPipe) subChapterOrder: number,
    @Param("contentId") contentId: string,
  ) {
    return this.subjectsService.deleteSubChapterContent(
      id,
      chapterOrder,
      subChapterOrder,
      contentId,
    );
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a subject" })
  remove(@Param("id") id: string) {
    return this.subjectsService.remove(id);
  }

  @Post("quiz-submissions/submit")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Submit quiz answers and save to database",
  })
  @ApiResponse({
    status: 201,
    description: "Quiz submission saved successfully",
  })
  async submitQuiz(@Req() req: any, @Body() submitQuizDto: SubmitQuizDto) {
    try {
      const studentId = req?.user?.userId || req?.user?._id || req?.user?.id;
      if (!studentId) {
        throw new BadRequestException(
          `Student ID not found in JWT token. User object: ${JSON.stringify(req?.user)}`,
        );
      }

      if (!submitQuizDto) {
        throw new BadRequestException("Submit data is required");
      }

      if (!submitQuizDto.quizId) {
        throw new BadRequestException("Quiz ID is required");
      }

      return await this.subjectsService.submitQuiz(
        String(studentId),
        submitQuizDto,
      );
    } catch (error: any) {
      console.error("Quiz submission error:", error.message);
      throw error;
    }
  }

  @Get("quiz-submissions/student")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get all quiz submissions for the current student",
  })
  getStudentQuizSubmissions(@Req() req: any) {
    const studentId = req?.user?.id || req?.user?.userId || req?.user?._id;
    if (!studentId) {
      throw new BadRequestException("Student ID not found in request");
    }
    return this.subjectsService.getStudentQuizSubmissions(studentId);
  }

  @Get("quiz-submissions/:submissionId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get details of a specific quiz submission",
  })
  getQuizSubmission(@Param("submissionId") submissionId: string) {
    return this.subjectsService.getQuizSubmission(submissionId);
  }

  @Get("quiz-submissions/:quizId/latest")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get the latest submission for a specific quiz",
  })
  getLatestQuizSubmission(@Req() req: any, @Param("quizId") quizId: string) {
    const studentId = req?.user?.id || req?.user?.userId || req?.user?._id;
    if (!studentId) {
      throw new BadRequestException("Student ID not found in request");
    }
    return this.subjectsService.getLatestStudentQuizSubmission(
      studentId,
      quizId,
    );
  }

  @Post("quiz-file-submissions/submit")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Submit file-based quiz response (PDF/Word). Grade is set later by instructor.",
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = getUploadsDir("subjects", "quiz-submissions");
          if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
          }
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const safeExt = extname(file.originalname || "").toLowerCase();
          const base = String(file.originalname || "file")
            .replace(/\.[^/.]+$/, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .slice(0, 80);
          cb(null, `${Date.now()}_${base}${safeExt || ""}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname || "").toLowerCase();
        const allowed = [".pdf", ".doc", ".docx", ".html", ".ppt", ".pptx"];
        if (!allowed.includes(ext)) {
          cb(
            new BadRequestException(
              "Only PDF, Word or PowerPoint files are allowed for quiz response",
            ) as any,
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async submitQuizFile(
    @Req() req: any,
    @Body() submitQuizFileDto: SubmitQuizFileDto,
    @UploadedFile() file: any,
  ) {
    const studentId = req?.user?.id || req?.user?.userId || req?.user?._id;
    if (!studentId) {
      throw new BadRequestException("Student ID not found in request");
    }

    if (!file) {
      throw new BadRequestException("Response file is required");
    }

    const protocol = String(req?.protocol || "http");
    const host = String(req?.get?.("host") || "localhost:3000");
    const relativePath = `/uploads/subjects/quiz-submissions/${file.filename}`;

    return this.subjectsService.submitQuizFile(
      String(studentId),
      submitQuizFileDto,
      {
        fileUrl: `${protocol}://${host}${relativePath}`,
        fileName: String(file.originalname || file.filename || "response"),
        mimeType: String(file.mimetype || "").trim() || undefined,
      },
    );
  }

  @Get("quiz-file-submissions/student")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current student quiz-file submissions" })
  getStudentQuizFileSubmissions(@Req() req: any) {
    const studentId = req?.user?.id || req?.user?.userId || req?.user?._id;
    if (!studentId) {
      throw new BadRequestException("Student ID not found in request");
    }
    return this.subjectsService.getStudentQuizFileSubmissions(
      String(studentId),
    );
  }

  @Get("quiz-file-submissions/instructor")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get all quiz-file submissions for instructor review",
  })
  getInstructorQuizFileSubmissions(@Req() req: any) {
    const instructorId = req?.user?.id || req?.user?.userId || req?.user?._id;
    if (!instructorId) {
      throw new BadRequestException("Instructor ID not found in request");
    }
    return this.subjectsService.getInstructorQuizFileSubmissions(
      String(instructorId),
    );
  }

  @Put("quiz-file-submissions/:submissionId/grade")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Grade a file-based quiz submission" })
  gradeQuizFileSubmission(
    @Req() req: any,
    @Param("submissionId") submissionId: string,
    @Body() gradeDto: GradeQuizFileSubmissionDto,
  ) {
    const graderId = req?.user?.id || req?.user?.userId || req?.user?._id;
    if (!graderId) {
      throw new BadRequestException("Grader ID not found in request");
    }
    return this.subjectsService.gradeQuizFileSubmission(
      submissionId,
      String(graderId),
      gradeDto,
    );
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjectsService.update(id, dto);
  }
}
