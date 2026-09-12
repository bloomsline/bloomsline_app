# locales/

These are the **iOS** Info.plist strings: the app's display name and the three
permission prompts, in the language the phone is set to.

Everything here lives under an `"ios"` key, and that nesting is load-bearing.
`app.json`'s `locales` is not an iOS-only setting: prebuild reads it for Android
too, and anything at the TOP level of these files is written into
`android/app/src/main/res/values-b+<lang>/strings.xml` as well. Android's release
lint then fails the build on `ExtraTranslation` — a string translated into `en`
and `fr` with nothing to translate in the default locale — because
`NSCameraUsageDescription` means nothing to Android and was never in
`values/strings.xml` to begin with. The first Android build we ever ran died
exactly there, on `:app:lintVitalRelease`, and nothing about the error names this
file.

If Android ever needs localized strings of its own, they go under an `"android"`
key in the same files. The top level is for keys that genuinely belong to both.
