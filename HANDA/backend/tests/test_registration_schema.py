import unittest

from pydantic import ValidationError

from app.schemas import UserRegistration


class UserRegistrationSchemaTests(unittest.TestCase):
    def test_reference_fields_are_accepted_without_address_or_middle_name(self):
        registration = UserRegistration.model_validate({
            "firstName": "Ana",
            "lastName": "Santos",
            "birthday": "2000-01-01",
            "sex": "Female",
            "mobileNumber": "09171234567",
            "email": "ana@example.com",
            "password": "StrongPass1!",
        })

        self.assertIsNone(registration.middleName)
        self.assertEqual(registration.currentAddress, "")

    def test_middle_name_and_sex_are_preserved(self):
        registration = UserRegistration.model_validate({
            "firstName": "Ana",
            "middleName": "Maria",
            "lastName": "Santos",
            "birthday": "2000-01-01",
            "sex": "Female",
            "mobileNumber": "09171234567",
            "email": "ana@example.com",
            "password": "StrongPass1!",
        })

        self.assertEqual(registration.middleName, "Maria")
        self.assertEqual(registration.sex, "Female")

    def test_sex_must_match_the_registration_choices(self):
        with self.assertRaises(ValidationError):
            UserRegistration.model_validate({
                "firstName": "Ana",
                "lastName": "Santos",
                "birthday": "2000-01-01",
                "sex": "Other",
                "mobileNumber": "09171234567",
                "email": "ana@example.com",
                "password": "StrongPass1!",
            })


if __name__ == "__main__":
    unittest.main()