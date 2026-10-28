@echo off
REM Local development launcher (Windows). Loads .env, starts PocketBase and opens the browser.
cd /d "%~dp0"
if not exist pocketbase.exe (
  echo pocketbase.exe not found. Download pocketbase_0.40.6_windows_amd64.zip from
  echo https://github.com/pocketbase/pocketbase/releases/tag/v0.40.6 and unzip it here.
  pause & exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do set "%%A=%%B"
start "" http://127.0.0.1:8090/
"%~dp0pocketbase.exe" serve --http=127.0.0.1:8090 --dir=pb_data --hooksDir=pb_hooks --migrationsDir=pb_migrations --publicDir=public --encryptionEnv=PB_ENCRYPTION_KEY
