using System.Buffers.Binary;
using System.Text;
using Application.Common.Models;
using Infrastructure.Implementations.Services.Uploads;

namespace UnitTests.Uploads;

/// <summary>Đọc kích thước ảnh từ header, không giải mã ảnh.</summary>
public class ImageInspectorTests
{
    private readonly ImageInspector _inspector = new();

    [Fact]
    public void Png_ReadsSizeFromIhdr()
    {
        var info = _inspector.Inspect(Png(640, 480));

        Assert.Equal(new ImageInfo(ImageFormat.Png, 640, 480), info);
        Assert.Equal("png", info!.Extension);
    }

    [Fact]
    public void Jpeg_SkipsApp0AndReadsSizeFromSof0()
    {
        var info = _inspector.Inspect(Jpeg(1920, 1080, sofMarker: 0xC0));

        Assert.Equal(new ImageInfo(ImageFormat.Jpeg, 1920, 1080), info);
    }

    [Fact]
    public void Jpeg_Progressive_ReadsSizeFromSof2()
    {
        var info = _inspector.Inspect(Jpeg(800, 600, sofMarker: 0xC2));

        Assert.Equal(new ImageInfo(ImageFormat.Jpeg, 800, 600), info);
    }

    [Fact]
    public void WebpLossy_ReadsSizeFromVp8FrameHeader()
    {
        var bytes = WebpHeader("VP8 ");
        bytes[23] = 0x9D;
        bytes[24] = 0x01;
        bytes[25] = 0x2A;
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(26), 1024);
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(28), 768);

        Assert.Equal(new ImageInfo(ImageFormat.Webp, 1024, 768), _inspector.Inspect(bytes));
    }

    [Fact]
    public void WebpLossless_ReadsSizeFromVp8lBits()
    {
        var bytes = WebpHeader("VP8L");
        bytes[20] = 0x2F;
        const uint width = 400, height = 300;
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(21), (width - 1) | ((height - 1) << 14));

        Assert.Equal(new ImageInfo(ImageFormat.Webp, 400, 300), _inspector.Inspect(bytes));
    }

    [Fact]
    public void WebpExtended_ReadsCanvasSizeFromVp8x()
    {
        var bytes = WebpHeader("VP8X");
        WriteUInt24LittleEndian(bytes, 24, 5000 - 1);
        WriteUInt24LittleEndian(bytes, 27, 2500 - 1);

        Assert.Equal(new ImageInfo(ImageFormat.Webp, 5000, 2500), _inspector.Inspect(bytes));
    }

    [Theory]
    [InlineData("""<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40px"></svg>""", 120, 40)]
    [InlineData("""<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32"></svg>""", 64, 32)]
    [InlineData("""  <svg width="100%" height="100%" viewBox="0,0,48,48"/>""", 48, 48)]
    [InlineData("""<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>""", 0, 0)]
    public void Svg_ReadsSizeFromAttributesOrViewBox(string svg, int width, int height)
    {
        var info = _inspector.Inspect(Encoding.UTF8.GetBytes(svg));

        Assert.Equal(new ImageInfo(ImageFormat.Svg, width, height), info);
    }

    [Fact]
    public void Svg_WithDoctype_IsRejected()
    {
        const string svg = """<!DOCTYPE svg [<!ENTITY x "y">]><svg width="1" height="1">&x;</svg>""";

        Assert.Null(_inspector.Inspect(Encoding.UTF8.GetBytes(svg)));
    }

    [Fact]
    public void TruncatedPng_ReturnsNull()
    {
        Assert.Null(_inspector.Inspect(Png(10, 10).AsSpan(0, 20)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("đây không phải ảnh")]
    [InlineData("<html><body>không phải svg</body></html>")]
    [InlineData("%PDF-1.7")]
    public void NonImage_ReturnsNull(string content)
    {
        Assert.Null(_inspector.Inspect(Encoding.UTF8.GetBytes(content)));
    }

    private static byte[] Png(uint width, uint height)
    {
        var bytes = new byte[33];
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }.CopyTo(bytes, 0);
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(8), 13);
        "IHDR"u8.CopyTo(bytes.AsSpan(12));
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(16), width);
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(20), height);
        return bytes;
    }

    private static byte[] Jpeg(ushort width, ushort height, byte sofMarker)
    {
        var bytes = new List<byte> { 0xFF, 0xD8 };

        // APP0 (JFIF) dài 16 byte, phải bỏ qua.
        bytes.AddRange([0xFF, 0xE0, 0x00, 0x10]);
        bytes.AddRange("JFIF\0"u8.ToArray());
        bytes.AddRange(new byte[9]);

        // SOFn: độ dài 17, độ chính xác 8, cao, rộng, 3 thành phần.
        bytes.AddRange([0xFF, sofMarker, 0x00, 0x11, 0x08]);
        bytes.AddRange([(byte)(height >> 8), (byte)height, (byte)(width >> 8), (byte)width]);
        bytes.AddRange(new byte[10]);
        bytes.AddRange([0xFF, 0xD9]);
        return bytes.ToArray();
    }

    private static byte[] WebpHeader(string chunk)
    {
        var bytes = new byte[40];
        "RIFF"u8.CopyTo(bytes);
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(4), 32);
        "WEBP"u8.CopyTo(bytes.AsSpan(8));
        Encoding.ASCII.GetBytes(chunk).CopyTo(bytes, 12);
        return bytes;
    }

    private static void WriteUInt24LittleEndian(byte[] bytes, int offset, int value)
    {
        bytes[offset] = (byte)value;
        bytes[offset + 1] = (byte)(value >> 8);
        bytes[offset + 2] = (byte)(value >> 16);
    }
}
