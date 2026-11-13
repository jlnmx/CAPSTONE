import base64
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app import main
from app.auth import CurrentUser
from app.schemas import ResponderApplicationReview


class ResponderVerificationImageTests(unittest.TestCase):
    def test_valid_jpeg_upload_is_decoded(self):
        image = b"\xff\xd8\xffresponder-image"

        decoded = main.decode_verification_image(base64.b64encode(image).decode("ascii"), "image/jpeg", "face")

        self.assertEqual(decoded, image)

    def test_image_mime_type_must_match_file_signature(self):
        image = base64.b64encode(b"\xff\xd8\xffresponder-image").decode("ascii")

        with self.assertRaises(HTTPException) as error:
            main.decode_verification_image(image, "image/png", "face")

        self.assertEqual(error.exception.status_code, 422)

    def test_uploaded_image_must_not_exceed_four_megabytes(self):
        oversized_image = b"\xff\xd8\xff" + b"x" * (4 * 1024 * 1024)
        encoded = base64.b64encode(oversized_image).decode("ascii")

        with self.assertRaises(HTTPException) as error:
            main.decode_verification_image(encoded, "image/jpeg", "face")

        self.assertEqual(error.exception.status_code, 413)

    def test_registration_rejects_face_upload_without_consent(self):
        registration = main.UserRegistration.model_validate({
            "firstName": "Ana",
            "lastName": "Santos",
            "birthday": "2000-01-01",
            "sex": "Female",
            "mobileNumber": "09171234567",
            "email": "ana@example.com",
            "password": "StrongPass1!",
            "registrationToken": "r" * 32,
            "role": "Responder",
            "responderType": "Official",
            "responderOrganization": "BFP",
            "verificationDocumentBase64": "aWQ=",
            "verificationDocumentMimeType": "image/jpeg",
            "verificationDocumentName": "responder-id.jpg",
            "facePhotoBase64": "ZmFjZQ==",
            "facePhotoMimeType": "image/jpeg",
            "facePhotoName": "responder-face.jpg",
        })

        with self.assertRaises(HTTPException) as error:
            main.register_user(registration, MagicMock())

        self.assertEqual(error.exception.status_code, 422)
        self.assertIn("Consent", error.exception.detail)

    def test_registration_requires_face_photo_after_consent(self):
        registration = main.UserRegistration.model_validate({
            "firstName": "Ana",
            "lastName": "Santos",
            "birthday": "2000-01-01",
            "sex": "Female",
            "mobileNumber": "09171234567",
            "email": "ana@example.com",
            "password": "StrongPass1!",
            "registrationToken": "r" * 32,
            "role": "Responder",
            "responderType": "Official",
            "responderOrganization": "BFP",
            "verificationDocumentBase64": "aWQ=",
            "verificationDocumentMimeType": "image/jpeg",
            "verificationDocumentName": "responder-id.jpg",
            "faceConsent": True,
        })

        with self.assertRaises(HTTPException) as error:
            main.register_user(registration, MagicMock())

        self.assertEqual(error.exception.status_code, 422)
        self.assertIn("face photo", error.exception.detail)

    def test_superadmin_review_response_includes_face_photo(self):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {
            "file_name": "responder-id.jpg",
            "mime_type": "image/jpeg",
            "file_bytes": b"\xff\xd8\xffid",
            "face_file_name": "responder-face.jpg",
            "face_mime_type": "image/jpeg",
            "face_file_bytes": b"\xff\xd8\xffface",
            "responder_type": "Official",
        }
        reviewer = CurrentUser("admin-1", "admin@example.com", "Superadmin", "admin", 0, is_superadmin=True)

        result = main.get_responder_verification_document("responder-1", connection, reviewer)

        self.assertEqual(result["faceFileName"], "responder-face.jpg")
        self.assertEqual(base64.b64decode(result["faceBase64"]), b"\xff\xd8\xffface")

    @patch("app.main.notify_responder_application_status")
    def test_review_decision_clears_face_image_bytes(self, _notify):
        connection = MagicMock()
        connection.execute.return_value.fetchone.return_value = {
            "id": "responder-1",
            "name": "Ana Santos",
            "email": "ana@example.com",
            "mobile_number": "09171234567",
            "role": "Responder",
            "status": "Pending",
            "responder_type": "Official",
        }
        reviewer = CurrentUser("admin-1", "admin@example.com", "Superadmin", "admin", 0, is_superadmin=True)

        main.review_responder_application(
            "responder-1",
            ResponderApplicationReview(decision="approved"),
            reviewer,
            connection,
        )

        review_update = next(
            call.args[0]
            for call in connection.execute.call_args_list
            if "UPDATE responder_verification_documents" in call.args[0]
        )
        self.assertIn("face_file_bytes = NULL", review_update)
        self.assertIn("face_file_name = NULL", review_update)
