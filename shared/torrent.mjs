// Stremio's streaming-server contract uses -1 to select the largest file.
export function torrentUrl(stream, base) {
  if (!/^[a-f0-9]{40}$/i.test(stream.infoHash || ""))
    throw new Error("This source has an invalid torrent hash.");
  const index = stream.fileIdx ?? -1;
  if (!Number.isInteger(index) || index < -1)
    throw new Error("This source has an invalid torrent file index.");
  const url = new URL(`${base}/${stream.infoHash.toLowerCase()}/${index}`);
  for (const source of stream.announce ?? stream.sources ?? [])
    if (typeof source === "string") url.searchParams.append("tr", source);
  for (const match of stream.fileMustInclude ?? [])
    if (typeof match === "string") url.searchParams.append("f", match);
  return url.href;
}

export function torrentHlsUrl(mediaURL, base, id) {
  const url = new URL(`${base}/hlsv2/${id}/master.m3u8`);
  url.searchParams.set("mediaURL", mediaURL);
  url.searchParams.append("videoCodecs", "h264");
  url.searchParams.append("audioCodecs", "aac");
  url.searchParams.append("audioCodecs", "mp3");
  url.searchParams.set("maxAudioChannels", "2");
  return url.href;
}
