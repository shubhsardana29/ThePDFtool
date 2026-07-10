import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildXlsx, groupIntoTable, toCsv } from "./table-extract";

describe("groupIntoTable", () => {
  it("groups positioned text into rows and columns", () => {
    const items = [
      { str: "Name", x: 50, y: 700 },
      { str: "Age", x: 200, y: 700 },
      { str: "Alice", x: 50, y: 680 },
      { str: "30", x: 200, y: 680 },
      { str: "Bob", x: 50, y: 660 },
      { str: "25", x: 200, y: 660 },
    ];
    expect(groupIntoTable(items)).toEqual([
      ["Name", "Age"],
      ["Alice", "30"],
      ["Bob", "25"],
    ]);
  });

  it("ignores blank runs and returns [] when empty", () => {
    expect(groupIntoTable([{ str: "   ", x: 0, y: 0 }])).toEqual([]);
  });
});

describe("toCsv", () => {
  it("escapes commas, quotes and newlines", () => {
    const csv = toCsv([
      ["a", "b,c", 'd"e'],
      ["f\ng", "h", "i"],
    ]);
    expect(csv).toBe('a,"b,c","d""e"\r\n"f\ng",h,i');
  });
});

describe("buildXlsx", () => {
  it("produces a valid xlsx zip with the expected parts", () => {
    const data = buildXlsx([{ name: "Page 1", rows: [["A", "B"], ["1", "2"]] }]);
    // Zip magic bytes.
    expect(data[0]).toBe(0x50);
    expect(data[1]).toBe(0x4b);
    const files = unzipSync(data);
    expect(Object.keys(files)).toContain("[Content_Types].xml");
    expect(Object.keys(files)).toContain("xl/workbook.xml");
    expect(Object.keys(files)).toContain("xl/worksheets/sheet1.xml");
    const sheet = new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("<t xml:space=\"preserve\">A</t>");
    expect(sheet).toContain("<t xml:space=\"preserve\">2</t>");
  });

  it("escapes XML special characters in cells", () => {
    const data = buildXlsx([{ name: "S", rows: [["<a>&b"]] }]);
    const sheet = new TextDecoder().decode(unzipSync(data)["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain("&lt;a&gt;&amp;b");
  });
});
