# PowerShell script to test Google Analytics integration
Write-Host "Building Spediak web app with Google Analytics..." -ForegroundColor Green

# Navigate to the Spediak directory
Set-Location "C:\Users\Nicolas\Desktop\final-app-2\app-spediak\Spediak"

# Install dependencies if needed
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Build the web version
Write-Host "Building web version..." -ForegroundColor Yellow
npx expo export -p web --output-dir web-build

# Check if the HTML file was created with Google Analytics
Write-Host "Checking if Google Analytics was added..." -ForegroundColor Yellow
if (Test-Path "web-build\index.html") {
    $content = Get-Content "web-build\index.html" -Raw
    if ($content -match "G-ZWZ92LRVPS") {
        Write-Host "✅ Google Analytics successfully added to web build!" -ForegroundColor Green
        Write-Host "Google Tag ID: G-ZWZ92LRVPS" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Google Analytics not found in the built HTML file" -ForegroundColor Red
    }
} else {
    Write-Host "❌ HTML file not found in web-build directory" -ForegroundColor Red
}

Write-Host "Build completed. You can now serve the web-build directory to test the integration." -ForegroundColor Green
Write-Host "To serve locally, you can use: npx serve web-build" -ForegroundColor Cyan
