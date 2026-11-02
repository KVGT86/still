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

export function torrentHlsDestroyUrl(value, hash) {
  try {
    const url = new URL(value);
    const media = new URL(url.searchParams.get("mediaURL"));
    if (
      !/^[a-f0-9]{40}$/i.test(hash || "") ||
      media.origin !== url.origin ||
      !media.pathname.toLowerCase().includes(`/${hash.toLowerCase()}/`) ||
      !/\/hlsv2\/[a-f0-9-]{36}\/master\.m3u8$/i.test(url.pathname)
    )
      return null;
    url.pathname = url.pathname.replace(/master\.m3u8$/, "destroy");
    url.search = "";
    return url.href;
  } catch {
    return null;
  }
}
