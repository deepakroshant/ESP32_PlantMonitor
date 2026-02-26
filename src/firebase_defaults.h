/**
 * Firebase default credentials (used when NVS has no saved values).
 *
 * SECURITY: Defaults are empty. Credentials must be entered via the
 * WiFiManager portal (192.168.4.1) on first setup — they are stored in NVS.
 *
 * Optional: Copy secrets.h.example to secrets.h and fill in for local dev.
 * secrets.h is gitignored.
 */
#pragma once

#if __has_include("secrets.h")
#include "secrets.h"
#endif

#ifndef FIREBASE_API_KEY
#define FIREBASE_API_KEY ""
#endif

#ifndef FIREBASE_DB_URL
#define FIREBASE_DB_URL ""
#endif

#ifndef FIREBASE_USER_EMAIL
#define FIREBASE_USER_EMAIL ""
#endif

#ifndef FIREBASE_USER_PASSWORD
#define FIREBASE_USER_PASSWORD ""
#endif
