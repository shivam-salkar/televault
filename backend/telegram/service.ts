import { TelegramClient, sessions, Api } from "teleproto";

export interface PendingAuth {
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  phoneCodeHash: string;
}

export class TelegramService {
  private static instance: TelegramService;
  private client: TelegramClient | null = null;
  private pendingAuth: PendingAuth | null = null;

  private constructor() {}

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  public getClient(): TelegramClient | null {
    return this.client;
  }

  public getPendingAuth(): PendingAuth | null {
    return this.pendingAuth;
  }

  /**
   * Step 1: Send verification code to user's phone number
   */
  public async sendCode(apiId: number, apiHash: string, phoneNumber: string) {
    if (!apiId || !apiHash || !phoneNumber) {
      throw new Error("apiId, apiHash, and phoneNumber are required.");
    }

    // Clean up any existing connection
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (_) {}
      this.client = null;
    }

    const session = new sessions.StringSession("");
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    const result = await client.sendCode(
      { apiId, apiHash },
      phoneNumber.trim()
    );

    this.client = client;
    this.pendingAuth = {
      apiId,
      apiHash,
      phoneNumber: phoneNumber.trim(),
      phoneCodeHash: result.phoneCodeHash,
    };

    return {
      status: "CODE_SENT",
      phoneCodeHash: result.phoneCodeHash,
      isCodeViaApp: result.isCodeViaApp,
    };
  }

  /**
   * Step 2: Sign in with the code received via SMS/Telegram app
   */
  public async signIn(phoneCode: string, password?: string) {
    if (!this.client || !this.pendingAuth) {
      throw new Error("No login in progress. Please request a code first.");
    }
    if (!phoneCode) {
      throw new Error("Verification code is required.");
    }

    try {
      await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: this.pendingAuth.phoneNumber,
          phoneCodeHash: this.pendingAuth.phoneCodeHash,
          phoneCode: phoneCode.trim(),
        })
      );

      return await this.finalizeAuth();
    } catch (err: any) {
      if (err.errorMessage === "SESSION_PASSWORD_NEEDED") {
        if (password) {
          return await this.submit2FA(password);
        }
        return {
          status: "2FA_REQUIRED",
          message: "2FA password is required to complete login.",
        };
      }
      throw err;
    }
  }

  /**
   * Step 3 (Optional): If account has 2FA enabled
   */
  public async submit2FA(password: string) {
    if (!this.client || !this.pendingAuth) {
      throw new Error("No login in progress. Please request a code first.");
    }
    if (!password) {
      throw new Error("2FA password is required.");
    }

    await this.client.signInWithPassword(
      {
        apiId: this.pendingAuth.apiId,
        apiHash: this.pendingAuth.apiHash,
      },
      {
        password: async () => password,
        onError: (err: any) => {
          throw err;
        },
      }
    );

    return await this.finalizeAuth();
  }

  /**
   * Restore a previously saved session (from safeStorage)
   */
  public async restoreSession(apiId: number, apiHash: string, sessionString: string) {
    if (!apiId || !apiHash || !sessionString) {
      throw new Error("apiId, apiHash, and sessionString are required.");
    }

    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (_) {}
    }

    const session = new sessions.StringSession(sessionString);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    const isAuthorized = await client.isUserAuthorized();
    if (!isAuthorized) {
      throw new Error("Saved session is invalid or expired.");
    }

    this.client = client;
    this.pendingAuth = null;

    const me = await client.getMe();
    return {
      status: "AUTHENTICATED",
      user: me,
    };
  }

  /**
   * Check connection and auth status
   */
  public async getStatus() {
    if (!this.client) {
      return {
        isConnected: false,
        isAuthenticated: false,
        pendingAuth: !!this.pendingAuth,
      };
    }

    const isAuth = await this.client.isUserAuthorized().catch(() => false);
    if (!isAuth) {
      return {
        isConnected: this.client.connected,
        isAuthenticated: false,
        pendingAuth: !!this.pendingAuth,
      };
    }

    const me = await this.client.getMe().catch(() => null);
    return {
      isConnected: true,
      isAuthenticated: true,
      pendingAuth: false,
      user: me,
    };
  }

  /**
   * Log out and clear current session
   */
  public async logout() {
    if (this.client) {
      try {
        await this.client.logOut();
      } catch (_) {
        await this.client.disconnect();
      }
      this.client = null;
      this.pendingAuth = null;
    }
    return { status: "LOGGED_OUT" };
  }

  private async finalizeAuth() {
    if (!this.client) {
      throw new Error("Telegram client missing during finalization.");
    }

    const sessionString = this.client.session.save() as unknown as string;
    const user = await this.client.getMe();
    const creds = {
      apiId: this.pendingAuth?.apiId,
      apiHash: this.pendingAuth?.apiHash,
      sessionString,
    };

    this.pendingAuth = null;

    return {
      status: "AUTHENTICATED",
      session: sessionString,
      credentials: creds,
      user,
    };
  }
}

export const telegramService = TelegramService.getInstance();
