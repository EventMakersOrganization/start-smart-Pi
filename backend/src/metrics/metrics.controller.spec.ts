import { MetricsController } from "./metrics.controller";
import { metricsRegister } from "./prometheus.registry";

describe("MetricsController", () => {
  it("returns prometheus metrics payload with content type", async () => {
    const controller = new MetricsController();
    const metricsSpy = jest
      .spyOn(metricsRegister, "metrics")
      .mockResolvedValue("test_metric 1\n");

    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const res = {
      setHeader: jest.fn(),
      status,
    } as any;

    await controller.metrics(res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", metricsRegister.contentType);
    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith("test_metric 1\n");
    expect(metricsSpy).toHaveBeenCalled();
  });
});
