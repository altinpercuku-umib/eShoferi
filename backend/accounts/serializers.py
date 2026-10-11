from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "username", "date_joined"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["email", "username", "password"]

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ky email është i regjistruar tashmë.")
        return value

    def validate(self, attrs):
        # Django's password validators: minimum length, not too common,
        # not all numbers, not too similar to the email/username.
        user = User(email=attrs["email"], username=attrs["username"])
        try:
            validate_password(attrs["password"], user=user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": list(error.messages)})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(self.context["request"], email=attrs["email"].lower(), password=attrs["password"])
        if user is None:
            # Same message whether the email exists or not, so attackers can't
            # use the login form to find out which emails are registered.
            raise serializers.ValidationError("Email ose fjalëkalim i pasaktë.")
        attrs["user"] = user
        return attrs
