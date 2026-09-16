import { Router, Request, Response } from "express";
import { telegramService } from "../telegram/service.js";

const router = Router();

/**
 * Step 1: Send OTP code
 * Request body: { apiId: number, apiHash: string, phoneNumber: string }
 */
router.post("/send-code", async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiId, apiHash, phoneNumber } = req.body;
    if (!apiId || !apiHash || !phoneNumber) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: apiId, apiHash, or phoneNumber",
      });
      return;
    }

    const result = await telegramService.sendCode(
      Number(apiId),
      String(apiHash),
      String(phoneNumber)
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Error in /send-code:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Failed to send code",
    });
  }
});

/**
 * Step 2: Sign in with received code
 * Request body: { phoneCode: string, password?: string }
 */
router.post("/sign-in", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneCode, password } = req.body;
    if (!phoneCode) {
      res.status(400).json({
        success: false,
        error: "Missing verification code (phoneCode)",
      });
      return;
    }

    const result = await telegramService.signIn(String(phoneCode), password);

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Error in /sign-in:", err);
    res.status(400).json({
      success: false,
      error: err.errorMessage || err.message || "Sign in failed",
    });
  }
});

/**
 * Step 3: Provide 2FA password if required
 * Request body: { password: string }
 */
router.post("/2fa", async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({
        success: false,
        error: "Missing 2FA password",
      });
      return;
    }

    const result = await telegramService.submit2FA(String(password));

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Error in /2fa:", err);
    res.status(400).json({
      success: false,
      error: err.errorMessage || err.message || "2FA verification failed",
    });
  }
});

/**
 * Restore an existing session from client-side secure storage
 * Request body: { apiId: number, apiHash: string, sessionString: string }
 */
router.post("/restore", async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiId, apiHash, sessionString } = req.body;
    if (!apiId || !apiHash || !sessionString) {
      res.status(400).json({
        success: false,
        error: "Missing apiId, apiHash, or sessionString",
      });
      return;
    }

    const result = await telegramService.restoreSession(
      Number(apiId),
      String(apiHash),
      String(sessionString)
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Error in /restore:", err);
    res.status(401).json({
      success: false,
      error: err.message || "Failed to restore session",
    });
  }
});

/**
 * Get current auth and connection status
 */
router.get("/status", async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await telegramService.getStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || "Failed to get status",
    });
  }
});

/**
 * Log out
 */
router.post("/logout", async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await telegramService.logout();
    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || "Logout failed",
    });
  }
});

export default router;
