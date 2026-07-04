import twilio from "twilio";
import { ENV } from "../../_core/env";

let restClient: twilio.Twilio | null = null;

export function getTwilioClient(): twilio.Twilio {
  if (!restClient) {
    const sid = ENV.twilioAccountSid;
    const token = ENV.twilioAuthToken;
    if (!sid || !token) {
      throw new Error(
        "TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN deben estar configuradas en las variables de entorno."
      );
    }
    restClient = twilio(sid, token);
  }
  return restClient;
}

export function createAccessToken(identity: string): string {
  const { AccessToken } = twilio.jwt;
  const { VoiceGrant } = AccessToken;

  if (
    !ENV.twilioAccountSid ||
    !ENV.twilioApiKey ||
    !ENV.twilioApiSecret ||
    !ENV.twilioTwimlAppSid
  ) {
    throw new Error(
      "Faltan variables Twilio para generar token de acceso (TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID)."
    );
  }

  const token = new AccessToken(
    ENV.twilioAccountSid,
    ENV.twilioApiKey,
    ENV.twilioApiSecret,
    { identity }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: ENV.twilioTwimlAppSid,
    incomingAllow: true,
  });

  token.addGrant(voiceGrant);
  return token.toJwt();
}

export async function clickToCall(
  clientNumber: string,
  baseUrl: string
): Promise<{ callSid: string }> {
  const client = getTwilioClient();
  const encodedClientNumber = encodeURIComponent(clientNumber);

  const call = await client.calls.create({
    to: ENV.advisorPhoneNumber,
    from: ENV.twilioPhoneNumber,
    url: `${baseUrl}/webhooks/twilio/outbound-bridge?To=${encodedClientNumber}`,
  });

  return { callSid: call.sid };
}

export async function sendSms(
  toNumber: string,
  body: string,
  mediaUrl?: string
): Promise<{ messageSid: string }> {
  const client = getTwilioClient();

  const opts: twilio.MessageListInstanceCreateOptions = {
    to: toNumber,
    from: ENV.twilioPhoneNumber,
    body,
  };
  if (mediaUrl) opts.mediaUrl = [mediaUrl];

  const msg = await client.messages.create(opts);
  return { messageSid: msg.sid };
}
