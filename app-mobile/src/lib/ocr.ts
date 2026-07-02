// Free OCR — photo se text nikalta hai (OCR.space free API).
// Free key: https://ocr.space/ocrapi (25,000/month free). Abhi 'helloworld' test key fallback.

const OCR_KEY = process.env.EXPO_PUBLIC_OCR_API_KEY || "helloworld";

export async function ocrImage(base64: string): Promise<string> {
  const form = new FormData();
  form.append("base64Image", `data:image/jpeg;base64,${base64}`);
  form.append("language", "eng");
  form.append("isOverlayRequired", "false");
  form.append("scale", "true");
  form.append("OCREngine", "2");

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { apikey: OCR_KEY },
    body: form,
  });

  const data = await res.json();

  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(" ")
      : data.ErrorMessage || "OCR error";
    throw new Error(msg);
  }

  return data?.ParsedResults?.[0]?.ParsedText ?? "";
}
