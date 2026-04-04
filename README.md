# Birdcall Dataset

This dataset contains metadata for 10 New Zealand bird audio samples.

## Structure
- fileName: name of the audio file
- species: bird species
- source: data source (e.g., xeno-canto)
- location: recording location
- recordedAt: recording date (may be empty if unavailable)
- pageTitle: original page title from source
- notes: additional comments or verification status

## Notes
- Audio files will be stored in AWS S3
- Metadata will be stored in MongoDB
- This CSV is used as a reference structure

## Status
- Initial dataset prepared
- Some species labels still need verification
