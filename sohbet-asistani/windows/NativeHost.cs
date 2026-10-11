using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Web.Script.Serialization;

public static class HizirNativeHost
{
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 12000000 };
    static readonly Stream Input = Console.OpenStandardInput();
    static readonly Stream Output = Console.OpenStandardOutput();
    static byte[] ReadExact(int count)
    {
        byte[] result = new byte[count];
        int offset = 0;
        while (offset < count) {
            int n = Input.Read(result, offset, count - offset);
            if (n == 0) return null;
            offset += n;
        }
        return result;
    }
    static void Send(object value)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(Json.Serialize(value));
        byte[] size = BitConverter.GetBytes(bytes.Length);
        Output.Write(size, 0, size.Length);
        Output.Write(bytes, 0, bytes.Length);
        Output.Flush();
    }
    public static void Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        while (true) {
            byte[] header = ReadExact(4);
            if (header == null) return;
            int length = BitConverter.ToInt32(header, 0);
            if (length <= 0 || length > 8192) return;
            byte[] requestBytes = ReadExact(length);
            if (requestBytes == null) return;
            object id = null;
            try {
                var request = Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(requestBytes));
                if (!request.TryGetValue("id", out id)) return;
                if (!request.ContainsKey("type") || Convert.ToString(request["type"]) != "read") {
                    Send(new { id = id, error = "Bilinmeyen istek." }); continue;
                }
                var config = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(root, "config.json"), Encoding.UTF8));
                string path = Convert.ToString(config["file"]);
                if (!Path.IsPathRooted(path) || !String.Equals(Path.GetExtension(path), ".fdb", StringComparison.OrdinalIgnoreCase)) throw new IOException();
                var info = new FileInfo(path);
                if (!info.Exists || info.Length > 8000000) throw new IOException();
                string stamp = info.LastWriteTimeUtc.Ticks.ToString() + ":" + info.Length.ToString();
                if (request.ContainsKey("stamp") && Convert.ToString(request["stamp"]) == stamp) {
                    Send(new { id = id, done = true, unchanged = true, stamp = stamp }); continue;
                }
                byte[] bytes;
                using (var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
                    if (file.Length > 8000000) throw new IOException();
                    using (var buffer = new MemoryStream()) { file.CopyTo(buffer); bytes = buffer.ToArray(); }
                }
                var after = new FileInfo(path);
                if (after.LastWriteTimeUtc.Ticks.ToString() + ":" + after.Length.ToString() != stamp) {
                    Send(new { id = id, error = "FastKeys dosyası kaydediliyor. Birkaç saniye sonra tekrar dene." }); continue;
                }
                string data = Convert.ToBase64String(bytes);
                const int chunkSize = 200000;
                for (int offset = 0; offset < data.Length; offset += chunkSize) {
                    int count = Math.Min(chunkSize, data.Length - offset);
                    Send(new { id = id, data = data.Substring(offset, count), done = false });
                }
                Send(new { id = id, done = true, stamp = stamp });
            } catch {
                Send(new { id = id, error = "Seçilen FastKeys dosyası okunamadı. Windows bağlantısını yeniden kur veya dosyanın kaydedilmesini bekle." });
            }
        }
    }
}
