# We deliberately use Django's built-in auth.User model rather than
# rolling a custom one, since the project's user needs (username, email,
# password) are fully covered by it and it keeps the auth flow simple.
