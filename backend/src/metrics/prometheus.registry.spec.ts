import { Registry } from "prom-client";
import { metricsRegister } from "./prometheus.registry";

describe("prometheus registry", () => {
  it("creates a registry and exposes default metrics", async () => {
    expect(metricsRegister).toBeInstanceOf(Registry);
    expect(metricsRegister.contentType).toContain("text/plain");

    const body = await metricsRegister.metrics();
    expect(typeof body).toBe("string");
  });
});
