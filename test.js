const extractTar = require(".");
const fs = require("fs");
const stream = require("stream");
const logStream = new stream.Writable({
    write(chunk, encoding, callback) {
        process.stdout.write(`[SYNC] ${chunk}`);
        callback();
      }
});
const logStreamAsync = new stream.Writable({
    write(chunk, encoding, callback) {
        process.stdout.write(`[ASYNC] ${chunk}`);
        callback();
      }
});
try{
    fs.rmSync("./test", {recursive: true});
}catch{}
try{
    extractTar.extract("./test.tar", logStream);
    console.log("[1] Passed\n");
}catch{
    console.error("[1] Not passed!");
    process.exit(1);
}
extractTar.extract_async("./test.tar", logStreamAsync).then(() => {
    console.log("[2] Passed\n");
    console.log("All tests done!");
}).catch(() => {
    console.error("[2] Not passed!");
    process.exit(1);
});