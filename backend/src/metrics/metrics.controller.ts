import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { metricsRegister } from "./prometheus.registry";

@Controller()
export class MetricsController {
  @Get("metrics")
  async metrics(@Res() res: Response): Promise<void> {
    res.setHeader("Content-Type", metricsRegister.contentType);
    const body = await metricsRegister.metrics();
    res.status(200).send(body);
  }
}
