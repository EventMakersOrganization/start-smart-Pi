import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as path from "path";
import { existsSync, mkdirSync } from "fs";
import { PrositsService } from "./prosits.service";
import { CreatePrositSubmissionDto } from "./dto/create-prosit-submission.dto";
import { GradePrositDto } from "./dto/grade-prosit.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../users/schemas/user.schema";

const storage = diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.join(process.cwd(), "uploads", "prosits");
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

@Controller("prosits")
export class PrositsController {
  constructor(private prositsService: PrositsService) {}

  @Post("submit")
  @UseInterceptors(FileInterceptor("file", { storage }))
  async submitProsit(
    @Body() dto: CreatePrositSubmissionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      const submission = await this.prositsService.createSubmission(dto, file);
      return {
        success: true,
        message: "Rendu enregistré avec succès",
        submission,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(
        `Erreur lors de l'enregistrement: ${message}`,
      );
    }
  }

  @Get("instructor/:instructorId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async getSubmissionsForInstructor(
    @Param("instructorId") instructorId: string,
    @Req() req: any,
  ) {
    const uid = String(req?.user?.id || req?.user?.userId || req?.user?._id || "");
    const role = String(req?.user?.role || "").toLowerCase();
    if (role !== UserRole.ADMIN && uid !== String(instructorId)) {
      throw new ForbiddenException("Accès refusé");
    }
    const submissions =
      await this.prositsService.getSubmissionsForInstructor(instructorId);
    return {
      success: true,
      count: submissions.length,
      submissions,
    };
  }

  @Post(":submissionId/grade")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  async gradeSubmission(
    @Param("submissionId") submissionId: string,
    @Body() dto: GradePrositDto,
    @Req() req: any,
  ) {
    const graderId = req?.user?.id || req?.user?.userId || req?.user?._id;
    if (!graderId) {
      throw new BadRequestException("Utilisateur non authentifié");
    }
    const submission = await this.prositsService.gradeSubmission(
      submissionId,
      String(graderId),
      dto.grade,
      dto.feedback,
    );
    return {
      success: true,
      message: "Note enregistrée",
      submission,
    };
  }

  @Get("chapter/:chapterTitle")
  async getByChapter(@Param("chapterTitle") chapterTitle: string) {
    const submissions =
      await this.prositsService.getSubmissionsByChapter(chapterTitle);
    return {
      success: true,
      count: submissions.length,
      submissions,
    };
  }

  @Get("student/:studentId")
  @UseGuards(JwtAuthGuard)
  async getByStudent(
    @Param("studentId") studentId: string,
    @Req() req: any,
  ) {
    const uid = String(req?.user?.id || req?.user?.userId || req?.user?._id || "");
    const role = String(req?.user?.role || "").toLowerCase();
    if (role !== UserRole.ADMIN && uid !== String(studentId)) {
      throw new ForbiddenException("Accès refusé");
    }
    const submissions =
      await this.prositsService.getSubmissionsByStudent(studentId);
    return {
      success: true,
      count: submissions.length,
      submissions,
    };
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    const submission = await this.prositsService.getSubmissionById(id);
    if (!submission) {
      throw new BadRequestException("Rendu non trouvé");
    }
    return {
      success: true,
      submission,
    };
  }

  @Get()
  async getAll() {
    const submissions = await this.prositsService.getAllSubmissions();
    return {
      success: true,
      count: submissions.length,
      submissions,
    };
  }
}
