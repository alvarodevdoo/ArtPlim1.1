@echo off
echo Testing Orders API...

echo.
echo 1. Login to get token...
curl -X POST "http://localhost:3001/api/auth/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@nartplim.com\",\"password\":\"admin123\"}" ^
  -o login_response.json

echo.
echo 2. Extract token and test orders endpoint...
for /f "tokens=2 delims=:" %%a in ('findstr "token" login_response.json') do (
  set TOKEN=%%a
)

echo Token found, testing orders...
curl -X GET "http://localhost:3001/api/sales/orders" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -o orders_response.json

echo.
echo 3. Display orders response...
type orders_response.json

echo.
echo 4. Cleanup...
del login_response.json
del orders_response.json