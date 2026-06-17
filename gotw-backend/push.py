"""
Web-push sender for ChugChug.

Generate a VAPID key pair once (e.g. `npx web-push generate-vapid-keys`) and set:
  VAPID_PUBLIC_KEY   (same value goes to the frontend as VITE_VAPID_PUBLIC_KEY)
  VAPID_PRIVATE_KEY  (backend only — keep secret)
  VAPID_SUBJECT      (mailto: or https URL, optional)

send_web_push returns: "ok" | "expired" | "error".
"""
import os
import json

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@chugchug.app")

try:
    from pywebpush import webpush, WebPushException
    _PW_OK = True
except Exception:  # library not installed yet
    _PW_OK = False


def push_ready() -> bool:
    return _PW_OK and bool(VAPID_PRIVATE_KEY)


def send_web_push(sub_row: dict, payload: dict) -> str:
    """Send one notification. sub_row needs endpoint/p256dh/auth."""
    if not push_ready():
        return "error"
    try:
        webpush(
            subscription_info={
                "endpoint": sub_row["endpoint"],
                "keys": {"p256dh": sub_row["p256dh"], "auth": sub_row["auth"]},
            },
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=86400,
        )
        return "ok"
    except WebPushException as e:  # type: ignore[name-defined]
        status = getattr(getattr(e, "response", None), "status_code", None)
        return "expired" if status in (404, 410) else "error"
    except Exception:
        return "error"
