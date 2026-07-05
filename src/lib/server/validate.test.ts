import { describe, expect, it } from "vitest";
import { fileExtension, sanitizeName, sniffMatchesExt } from "./validate";

const PDF = new TextEncoder().encode("%PDF-1.7 fake");
const ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
const OLE = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0]);
const HTML = new TextEncoder().encode("<!doctype html><p>hi</p>");
const BINARY = Uint8Array.from([0x00, 0x01, 0x02]);

describe("fileExtension", () => {
  it("lowercases and extracts the final extension", () => {
    expect(fileExtension("Report.V2.PDF")).toBe("pdf");
    expect(fileExtension("noext")).toBe("");
  });
});

describe("sniffMatchesExt", () => {
  it("accepts matching magic bytes", () => {
    expect(sniffMatchesExt(PDF, "pdf")).toBe(true);
    expect(sniffMatchesExt(ZIP, "docx")).toBe(true);
    expect(sniffMatchesExt(ZIP, "xlsx")).toBe(true);
    expect(sniffMatchesExt(OLE, "doc")).toBe(true);
    expect(sniffMatchesExt(HTML, "html")).toBe(true);
  });
  it("rejects mismatched content", () => {
    expect(sniffMatchesExt(ZIP, "pdf")).toBe(false); // zip renamed to .pdf
    expect(sniffMatchesExt(PDF, "docx")).toBe(false); // pdf renamed to .docx
    expect(sniffMatchesExt(BINARY, "html")).toBe(false); // binary as html
  });
  it("rejects unknown extensions", () => {
    expect(sniffMatchesExt(PDF, "exe")).toBe(false);
  });
});

describe("sanitizeName", () => {
  it("strips paths and dangerous characters", () => {
    expect(sanitizeName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeName("C:\\x\\rep ort.pdf")).toBe("rep ort.pdf");
    expect(sanitizeName('we"ird<>|.pdf')).toBe("we_ird___.pdf");
  });
  it("never returns an empty name", () => {
    expect(sanitizeName("///")).toBe("file");
  });
});
