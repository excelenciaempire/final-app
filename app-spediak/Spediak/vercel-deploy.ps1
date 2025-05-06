# Build the Expo app for web
Write-Host "Building Expo app for web..." -ForegroundColor Green
npm run build

# Verify deployment files
Write-Host "Preparing deployment files..." -ForegroundColor Green
Copy-Item -Force vercel.json dist/vercel.json
Copy-Item -Force public/_redirects dist/_redirects
Copy-Item -Force public/404.html dist/404.html

Write-Host "Files ready for deployment!" -ForegroundColor Green
Write-Host "Please upload the 'dist' folder to Vercel manually through their web interface." -ForegroundColor Yellow
Write-Host "Make sure to set the Output Directory to 'dist' in your Vercel project settings." -ForegroundColor Yellow 