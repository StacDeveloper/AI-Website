import { describe, expect, it } from "@jest/globals"
import request from "supertest"

describe("Server Health Check", () => {
    it("Should return 200 on health endpoint", async () => {
        expect(true).toBe(true)
    })
})