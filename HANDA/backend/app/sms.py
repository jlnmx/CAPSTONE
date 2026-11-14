import base64
import json
import logging
import re
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .config import settings

logger = logging.getLogger(__name__)

SEMAPHORE_MESSAGES_URL = "https://api.semaphore.co/api/v4/messages"
SEMAPHORE_PRIORITY_URL = "https://api.semaphore.co/api/v4/priority"
SEMAPHORE_OTP_URL = "https://api.semaphore.co/api/v4/otp"


class SmsDeliveryError(RuntimeError):
    pass


def normalize_sms_number(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 11 and digits.startswith("0"):
        return f"+63{digits[1:]}"
    if len(digits) == 12 and digits.startswith("63"):
        return f"+{digits}"
    return value


def _semaphore_number(value: str) -> str:
    normalized = normalize_sms_number(value)
    return normalized[1:] if normalized.startswith("+") else normalized


def sms_delivery_configured(configuration=settings) -> bool:
    semaphore_configured = bool(str(getattr(configuration, "semaphore_api_key", "")).strip())
    twilio_configured = all(
        str(getattr(configuration, setting, "")).strip()
        for setting in ("twilio_account_sid", "twilio_auth_token", "twilio_from_number")
    )
    return semaphore_configured or twilio_configured


def _validate_semaphore_response(response_body: bytes) -> None:
    try:
        payload = json.loads(response_body)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise SmsDeliveryError("Semaphore returned an invalid response.") from error

    entries = payload if isinstance(payload, list) else [payload]
    if not entries:
        raise SmsDeliveryError("Semaphore did not accept the SMS request.")
    for entry in entries:
        if not isinstance(entry, dict):
            raise SmsDeliveryError("Semaphore returned an invalid response.")
        if str(entry.get("status", "")).casefold() in {"failed", "error", "rejected"}:
            raise SmsDeliveryError("Semaphore did not accept the SMS request.")


def _send_semaphore(url: str, fields: dict[str, str], configuration) -> None:
    payload = {"apikey": configuration.semaphore_api_key, **fields}
    sender_name = str(getattr(configuration, "semaphore_sender_name", "")).strip()
    if sender_name:
        payload["sendername"] = sender_name
    request = Request(
        url,
        data=urlencode(payload).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urlopen(request, timeout=10) as response:
            body = response.read()
    except HTTPError as error:
        raise SmsDeliveryError(f"Semaphore rejected the SMS request (HTTP {error.code}).") from None
    _validate_semaphore_response(body)


def _send_twilio(number: str, message: str, configuration) -> None:
    account_sid = configuration.twilio_account_sid
    body = urlencode({
        "To": normalize_sms_number(number),
        "From": configuration.twilio_from_number,
        "Body": message,
    }).encode()
    request = Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
        data=body,
        headers={
            "Authorization": "Basic " + base64.b64encode(
                f"{account_sid}:{configuration.twilio_auth_token}".encode()
            ).decode(),
        },
    )
    with urlopen(request, timeout=10):
        pass


def send_sms(number: str, message: str, priority: bool = False, configuration=settings) -> None:
    if not number.strip() or not message.strip():
        raise ValueError("An SMS recipient and message are required.")
    if str(getattr(configuration, "semaphore_api_key", "")).strip():
        endpoint = SEMAPHORE_PRIORITY_URL if priority else SEMAPHORE_MESSAGES_URL
        _send_semaphore(endpoint, {
            "number": _semaphore_number(number),
            "message": message,
        }, configuration)
        return
    if sms_delivery_configured(configuration):
        _send_twilio(number, message, configuration)
        return
    raise SmsDeliveryError("SMS delivery is not configured.")


def send_sms_to_many(
    numbers: list[str],
    message: str,
    priority: bool = False,
    configuration=settings,
) -> None:
    recipients = [_semaphore_number(number) for number in numbers if number.strip()]
    if not recipients or not message.strip():
        return
    if str(getattr(configuration, "semaphore_api_key", "")).strip():
        endpoint = SEMAPHORE_PRIORITY_URL if priority else SEMAPHORE_MESSAGES_URL
        for offset in range(0, len(recipients), 1000):
            _send_semaphore(endpoint, {
                "number": ",".join(recipients[offset:offset + 1000]),
                "message": message,
            }, configuration)
        return
    for recipient in recipients:
        send_sms(recipient, message, priority, configuration)


def send_sms_otp(number: str, code: str, message: str, configuration=settings) -> None:
    if not str(getattr(configuration, "semaphore_api_key", "")).strip():
        send_sms(number, message.replace("{otp}", code), configuration=configuration)
        return
    _send_semaphore(SEMAPHORE_OTP_URL, {
        "number": _semaphore_number(number),
        "message": message,
        "code": code,
    }, configuration)
