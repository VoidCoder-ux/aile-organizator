import * as admin from "firebase-admin";
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";

admin.initializeApp();

type AlertPayload = {
  childId: string;
  kind: "sos" | "lowBattery" | "geofence" | "checkIn";
  message: string;
};

type SessionPayload = {
  childId: string;
  kind: "audio" | "video";
  status: "requested" | "accepted" | "declined" | "active" | "ended" | "expired";
};

export const notifyParentsOnAlert = onDocumentCreated(
  "families/{familyId}/alerts/{alertId}",
  async (event) => {
    const familyId = event.params.familyId;
    const alert = event.data?.data() as AlertPayload | undefined;
    if (!alert) return;

    const parentDevices = await admin.firestore()
      .collection(`families/${familyId}/devices`)
      .where("role", "==", "parent")
      .get();

    const tokens = parentDevices.docs
      .map((doc) => doc.data().fcmToken as string | undefined)
      .filter((token): token is string => Boolean(token));

    if (tokens.length === 0) return;

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: alert.kind === "sos" ? "SOS Alert" : "Family Safety Alert",
        body: alert.message,
      },
      data: {
        familyId,
        childId: alert.childId,
        kind: alert.kind,
      },
    });
  }
);

export const notifyChildOnSessionRequest = onDocumentCreated(
  "families/{familyId}/sessions/{sessionId}",
  async (event) => {
    const familyId = event.params.familyId;
    const sessionId = event.params.sessionId;
    const session = event.data?.data() as SessionPayload | undefined;
    if (!session || session.status !== "requested") return;

    const device = await admin.firestore()
      .doc(`families/${familyId}/devices/${session.childId}`)
      .get();

    const token = device.data()?.fcmToken as string | undefined;
    if (!token) return;

    await admin.messaging().send({
      token,
      notification: {
        title: `${session.kind === "video" ? "Video" : "Audio"} request`,
        body: "A paired parent is requesting a live session. Accept or decline on this device.",
      },
      data: {
        familyId,
        sessionId,
        kind: session.kind,
        status: "requested",
      },
    });
  }
);

export const notifyParentOnSessionResponse = onDocumentUpdated(
  "families/{familyId}/sessions/{sessionId}",
  async (event) => {
    const before = event.data?.before.data() as SessionPayload | undefined;
    const after = event.data?.after.data() as SessionPayload | undefined;
    if (!before || !after || before.status === after.status) return;
    if (!["accepted", "declined", "ended"].includes(after.status)) return;

    const parentDevices = await admin.firestore()
      .collection(`families/${event.params.familyId}/devices`)
      .where("role", "==", "parent")
      .get();

    const tokens = parentDevices.docs
      .map((doc) => doc.data().fcmToken as string | undefined)
      .filter((token): token is string => Boolean(token));

    if (tokens.length === 0) return;

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "Live session update",
        body: `The child ${after.status} the ${after.kind} session.`,
      },
      data: {
        familyId: event.params.familyId,
        sessionId: event.params.sessionId,
        status: after.status,
      },
    });
  }
);

