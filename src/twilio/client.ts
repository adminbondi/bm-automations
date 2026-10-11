export type TwilioConnection = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  senderName: string;
  fromMode?: "number" | "name";
};

// Outbound texts only. The number's incoming-message webhook belongs to Chatwoot.
export class TwilioClient {
  constructor(
    private readonly connection: TwilioConnection,
    private readonly fetchImpl: typeof fetch,
  ) {}

  fromAddress(): string {
    if (this.connection.fromMode === "name") return this.connection.senderName;
    return this.connection.fromNumber;
  }

  async sendSms(input: { to: string; body: string }): Promise<void> {
    const from = this.fromAddress();
    if (!this.connection.accountSid || !this.connection.authToken) throw new Error("twilio_credentials_missing");
    if (!from) throw new Error("twilio_from_missing");
    const response = await this.fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.connection.accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${this.connection.accountSid}:${this.connection.authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: input.to, From: from, Body: input.body }),
      },
    );
    if (!response.ok) throw new Error(`twilio_${response.status}`);
  }
}
