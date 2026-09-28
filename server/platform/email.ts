export interface TransactionalEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  send(message: TransactionalEmail): Promise<{ id: string }>;
}

export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(message: TransactionalEmail): Promise<{ id: string }> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    if (!response.ok) throw new Error('Resend email failed (' + response.status + ')');
    const data = await response.json() as { id?: string };
    if (!data.id) throw new Error('Resend returned no email id');
    return { id: data.id };
  }
}
