# redfox-music-zambia
Music catalog and artist discovery for Zambia.

This project includes a complete Node.js music platform for RedFox Music Studio Zambia with:

- Public music library and search
- Free direct download button for every published song
- Working HTML5 audio player
- Owner-only admin dashboard
- Upload ofMP3, WAV, FLAC, AAC, M4A, OGG, MP4 and cover art
- Publishing, unpublishing, preview, and delete tools
- Download counting for successful file requests

## Quick start

1. Install dependencies:
   npm install

2. Set your admin login credentials before publishing live:
   export ADMIN_USERNAME=redfoxadmin
   export ADMIN_PASSWORD=your-strong-password
   export SESSION_SECRET=choose-a-long-random-secret

3. Start the app:
   npm start

4. Open the public library in your browser:
   http://localhost:3000

5. Open the admin dashboard:
   http://localhost:3000/admin

## First upload workflow

1. Sign in to the admin dashboard with your chosen credentials.
2. Choose an audio file (for example .mp3 or .wav) and cover image.
3. Fill in the title, artist, genre, release date, description, and publication checkbox.
4. Click Save song.
5. The song is immediately visible in the public library if you selected Publish immediately.
6. Visitors can stream the song and click Download Free to save the original file directly to their device.

## What is included

- Free download route: /download/:id
- Player: HTML5 audio element in the public library
- Admin dashboard: /admin
- Storage check: /api/public/settings
- Search and filtering by title, artist, and genre
- Administrative upload validation and filesystem storage

## Storage and cost guidance

The app includes storage and bandwidth settings in data/settings.json and the admin dashboard. Default settings are:

- 50 GB storage
- 250 GB monthly transfer
- Typical budget: $5-$20/month for a small library, increasing with heavy download traffic

If you expect lots of daily downloads, use a plan with a higher bandwidth cap or object storage.

## Security notes

- Only admin users can upload, edit, or delete files.
- Audio and cover file types are validated.
- File size is limited to 250MB per upload.
- Uploaded files are stored on the server and served through the app.
- Session authentication is required for admin actions.

## Deployment checklist

Before you publish publicly:

- Use a real admin username and password.
- Store them in environment variables, not in plain code.
- Upload only audio that you own or are licensed to distribute.
- Confirm that the public library is accessible and that the download button triggers the original file download.
- Monitor the admin dashboard stats for successful downloads and bandwidth usage.
