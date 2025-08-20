Developer scripts and notes

- `scripts/` contained scraping and probe scripts used for data collection and analysis. These are developer tools and are not part of the app bundle.
- `src/PlannerClassic.jsx` was a legacy wrapper for a 'classic' UI variant; its CSS was missing and the file was unused by the app.

If you want to restore scripts, move them from `archive/scripts/` back to `scripts/`.

Cleanup / restore instructions

- I created `archive/` and copied several scripts and added placeholders for large probe JSONs.
- This run may not have removed the original `scripts/` files or the probe JSONs due to environment restrictions. To finalize cleanup, you can run the following git commands locally:

# Move originals into archive (example)
# git mv scripts archive/scripts && git mv probe-top-items.json archive/ && git commit -m "archive dev scripts and probe data"

- Or delete originals after verifying the archive copies.
