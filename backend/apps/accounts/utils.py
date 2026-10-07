import phonenumbers
from rest_framework.exceptions import ValidationError

def normalize_kenyan_phone(raw_phone: str) -> str:
    if not raw_phone or not str(raw_phone).strip():
        raise ValidationError("Phone number cannot be blank.")
    
    cleaned = str(raw_phone).strip().replace(" ", "").replace("-", "")
    
    try:
        parsed = phonenumbers.parse(cleaned, "KE")
    except phonenumbers.NumberParseException as exc:
        raise ValidationError(f"Invalid phone format: '{raw_phone}'. ({exc._msg})")

    if not phonenumbers.is_valid_number_for_region(parsed, "KE"):
        raise ValidationError(f"'{raw_phone}' is not a valid Kenyan mobile number.")

    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)