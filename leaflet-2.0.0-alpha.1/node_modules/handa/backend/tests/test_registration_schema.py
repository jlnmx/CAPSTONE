import unittest

from pydantic import ValidationError

from app.schemas import EvacuationRegistrationCreate, ResidentProfileUpdate, UserRegistration


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

    def test_account_registration_accepts_household_members(self):
        registration = UserRegistration.model_validate({
            "firstName": "Ana",
            "lastName": "Santos",
            "birthday": "2000-01-01",
            "sex": "Female",
            "mobileNumber": "09171234567",
            "email": "ana@example.com",
            "password": "StrongPass1!",
            "members": [{"name": "Luis Santos", "relationship": "Son"}],
        })

        self.assertEqual(registration.members[0].relationship, "Son")

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

    def test_resident_profile_update_includes_household_members(self):
        profile = ResidentProfileUpdate.model_validate({
            "firstName": "Ana",
            "lastName": "Santos",
            "birthday": "2000-01-01",
            "sex": "Female",
            "mobileNumber": "09171234567",
            "currentAddress": "12 Main Street",
            "members": [{"name": "Luis Santos", "relationship": "Son"}],
        })

        self.assertEqual(profile.members[0].name, "Luis Santos")


class EvacuationRegistrationSchemaTests(unittest.TestCase):
    def test_reference_form_fields_and_household_members_are_accepted(self):
        registration = EvacuationRegistrationCreate.model_validate({
            "centerId": "center-poblacion",
            "firstName": "Ana",
            "middleName": "Maria",
            "lastName": "Santos",
            "age": 32,
            "sex": "Female",
            "contactNumber": "09171234567",
            "address": "12 Main Street, Biñan",
            "householdSize": 2,
            "members": [{"name": "Luis Santos", "relationship": "Son"}],
        })

        self.assertEqual(registration.householdSize, 2)
        self.assertEqual(registration.members[0].relationship, "Son")

    def test_household_size_has_a_fixed_upper_bound(self):
        with self.assertRaises(ValidationError):
            EvacuationRegistrationCreate.model_validate({
                "centerId": "center-poblacion",
                "firstName": "Ana",
                "lastName": "Santos",
                "age": 32,
                "sex": "Female",
                "contactNumber": "09171234567",
                "address": "12 Main Street, Biñan",
                "householdSize": 22,
            })


if __name__ == "__main__":
    unittest.main()