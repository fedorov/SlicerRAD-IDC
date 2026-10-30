# SlicerRAD-IDC

A **stable, read-only web viewer for the [NCI Imaging Data Commons (IDC)](https://imaging.datacommons.cancer.gov/)**,
built on the SlicerLive WebGPU renderer and the IHE Radiology **Basic Image Review (BIR)** tool set.
It is a drop-in for OHIF-style IDC deep links: paste an IDC study URL and it opens the study in a
zero-install 4-up MPR + 3D reader.

**Live:** https://pieper.github.io/SlicerRAD-IDC/

> For Investigational Use Only — Not for Diagnostic Use.

## Why a separate repo

This is a **pinned, selectively-updated** distribution of the SlicerLive BIR reader. SlicerLive
(the renderer + demos) moves fast; SlicerRAD-IDC intentionally does **not** float with it. The
exact renderer version is pinned via the `vendor/SlicerLive` git submodule, so an IDC deployment
stays stable until someone deliberately takes an update.

## What's different from the SlicerLive demo

- **Measurements are disabled** (no Distance / Angle annotations). There is no annotation
  persistence yet, so the tools are hidden to avoid work the user can't save. Everything else in
  the BIR tool set stays: scroll, window/level, zoom, pan, select viewport, crosshair, layouts,
  cine, invert, reset, print.
- **Share and Download are kept** — copy an IDC-portal-style deep link, or stream the study's
  DICOM to a local folder.
- **Full-study series panel (OHIF-style):** a left thumbnail strip lists every series in the
  study (image stacks + SEG + SR/RTSTRUCT/…), ordered by series number, with real per-series
  previews. Click a series to load it — this works even when you arrive by a series-level URL
  (`SeriesInstanceUIDs`), so the whole study is always browsable.
- **Patient/study browser links removed** — this viewer is study-scoped; the series panel is the
  navigation surface.
- Volume-rendering presets (Slicer/OHIF CT presets, thumbnails rendered on the fly) and the VR
  shift slider are carried forward.

## URL parameters (OHIF / IDC-portal compatible)

```
# OHIF / IDC-portal form
?StudyInstanceUIDs=<uid>[,<uid>]&SeriesInstanceUIDs=<uid,...>&initialSeriesInstanceUID=<uid>

# IHE Invoke Image Display (IID) form
?requestType=STUDY&studyUID=<uid>&seriesUID=<uid>

# index-free direct form (opens straight from the IDC S3 bucket)
?series=<crdc_series_uuid>&bucket=idc-open-data[&seg=<uuid>&segBucket=idc-open-data&modality=CT]

# either UID form, plus segmentations from a Google Cloud Healthcare DICOM store
&gcp=projects/<p>/locations/<l>/datasets/<d>/dicomStores/<s>
```

StudyInstanceUID → S3 resolution asks the IDC API (`api.imaging.datacommons.cancer.gov/v3/sql`)
for the study's series; the images themselves are read straight from IDC's public S3 bucket.

Example (KiTS-00051):
<https://pieper.github.io/SlicerRAD-IDC/?StudyInstanceUIDs=1.3.6.1.4.1.14519.5.2.1.6919.4624.368281589441706814147998236429>

## Segmentations from a Google Cloud DICOM store (`?gcp=`)

For reviewing segmentations (from an AI model or annotators) that are kept in a private
[Cloud Healthcare](https://cloud.google.com/healthcare-api/docs/how-tos/dicomweb) DICOM store
rather than in IDC. The images still come from IDC; the store adds SEG series to the same study.
`?gcp=` takes the same values as IDC's OHIF and Slim: the store path, the full
`https://healthcare.googleapis.com/v1/projects/…/dicomStores/<s>[/dicomWeb]` URL, or OHIF's
`…/dicomStores/<s>/study/<uid>[/series/<uid>]` form.

- **Sign-in.** The page asks you to *Sign in with Google* (or *Continue without*, which opens the
  IDC study as usual). The access token — scope `cloud-healthcare`, so what you can read is what
  your IAM role on the store allows (`roles/healthcare.dicomViewer` is enough) — is kept in this
  tab's session storage and sent only to `healthcare.googleapis.com`.
- **Which segmentation opens.** A SEG named in `SeriesInstanceUIDs` (either source's), else the
  store's first SEG (by series number, then date) that was drawn on an IDC image series, over that
  series. Only BINARY SEGs decode; a multi-instance SEG shows its first instance.
- **Series panel.** The store's SEGs come first, tagged **GCP** (hover for the store). Clicking one
  drawn on the open series swaps the overlay in place; one drawn on another series opens that
  series with it.
- **Data sources** (cloud icon in the toolbar): change or remove the store — paste a path or URL,
  or pick a recent one — and sign in or out.
- **Share** links carry `gcp=` and the SEG; whoever opens one signs in with their own account.
  **Download** is IDC's public series only.
- **Testing without an OAuth client:** append `&token=$(gcloud auth print-access-token)`. The token
  is taken off the address bar as soon as the page reads it and is good for about an hour.

The OAuth client is a deployment setting: create a *Web application* client in Google Cloud
Console (Google Auth Platform → Clients) with the site's origin under *Authorized JavaScript
origins* (no redirect URI is needed — sign-in uses the Google Identity Services token popup), then
set its client id as the repository variable `GOOGLE_OAUTH_CLIENT_ID`. Without it the sign-in
button says sign-in isn't configured, and `&token=` still works.

## Build

```
git submodule update --init --recursive
deno task build          # → _site/  (bir.js + index.html + config.js + workers)
GOOGLE_OAUTH_CLIENT_ID=<id>.apps.googleusercontent.com deno task build   # with Google sign-in
```

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: it checks out the pinned submodule, bundles
the reader with Deno + esbuild (passing the `GOOGLE_OAUTH_CLIENT_ID` repo variable to the build),
and publishes `_site/` to GitHub Pages.

## Taking a SlicerLive update (selective)

```
cd vendor/SlicerLive
git fetch origin
git checkout <commit-or-tag>     # pick the version to ship
cd ../..
git add vendor/SlicerLive
git commit -m "vendor: bump SlicerLive to <commit>"
git push                          # the deploy Action rebuilds + redeploys
```

## Roadmap

- Instant in-place series switching (currently a reload per switch — robust and deep-linkable).
- Per-series thumbnails for non-image objects beyond a modality placeholder.
