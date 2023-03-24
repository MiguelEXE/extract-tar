const fs = require("fs");
const MAGIC_POSIX = Buffer.from("ustar\x0000", "ascii");
const MAGIC_GNU = Buffer.from("ustar\040\040\0");

function nextSector(tarball_fd){
    const buf = Buffer.allocUnsafe(512);
    fs.readSync(tarball_fd, buf);
    return buf;
}
function compare(buf1, buf2){
    const maxLength = Math.max(buf1.length, buf2.length);
    for(let i=0;i<maxLength;i++){
        if(buf1[i] !== buf2[i]){
            return false;
        }
    }
    return true;
}
function checkMagic(sectorData){
    const magicNum = sectorData.subarray(257, 257+8);
    const posix_ok = compare(magicNum, MAGIC_POSIX);
    const gnu_ok = compare(magicNum, MAGIC_GNU);
    return posix_ok || gnu_ok;
}
function toOctal(buf){
    return parseInt(buf.toString("ascii"), 8);
}
function nextHeader(tarball_fd){
    const sector = nextSector(tarball_fd);
    
    const name = sector.subarray(0,100).toString("ascii").replace(/\0/g, "");
    const mode = toOctal(sector.subarray(100,108));
    const owneruid = toOctal(sector.subarray(108,116));
    const ownergid = toOctal(sector.subarray(116, 124));
    const size = toOctal(sector.subarray(124, 136));
    const lastModification = new Date(toOctal(sector.subarray(136, 148)) * 1000);
    const checksum = sector.subarray(148, 156);
    const typeFlag = sector.subarray(156,157).toString("ascii");

    // USTAR
    const linkedName = sector.subarray(157, 257).toString("ascii").replace(/\0/g, "");
    //Skipping ustar magic, checkMagic() already does that
    const ownerUsername = sector.subarray(265, 297).toString("ascii").replace(/\0/g, "");
    const ownerGroupname = sector.subarray(297, 329).toString("ascii").replace(/\0/g, "");
    const deviceMajorNumber = sector.subarray(329, 337);
    const deviceMinorNumber = sector.subarray(337, 345);
    const filenamePrefix = sector.subarray(345, 500).toString("ascii").replace(/\0/g, "");

    const obj = {
        name,
        mode,
        owneruid,
        ownergid,
        size,
        lastModification,
        checksum,
        typeFlag,
        linkedName,
        ownerUsername,
        ownerGroupname,
        deviceMajorNumber,
        deviceMinorNumber,
        filenamePrefix,
        
        _realFileName: filenamePrefix + name,
        _sectorsToRead: Math.ceil(size / 512),
        _originalSector: sector
    };
    return obj;
}
function log(str, shouldLog){
    if(shouldLog){
        console.log(str);
    }
}
/**
 * Extract a tar (synchronous, so it can stops the event handler)
 * @param {fs.PathLike} tarballPath 
 * @param {boolean | false} shouldLogToConsole 
 * @returns 
 */
function extract(tarballPath, shouldLogToConsole = false){
    if(!fs.existsSync(tarballPath)){
        throw new Error("Non-existant path");
    }
    const tar_fd = fs.openSync(tarballPath, "r");

    while(true){
        const header = nextHeader(tar_fd);
        if((!checkMagic(header._originalSector))){
            break;
        }
        log(header._realFileName, shouldLogToConsole);
        
        if(header.typeFlag === "5"){
            fs.mkdirSync(header._realFileName, {recursive: true});
            continue;
        }

        if(header.typeFlag === "\x00" || header.typeFlag === "0"){
            let size = header.size;
            let sectors = 0;
            const fd = fs.openSync(header._realFileName, "w");
            while(true){
                const sector = nextSector(tar_fd);
                sectors++;
                if(size < 512){
                    const croppedData = sector.subarray(0, size);
                    fs.writeSync(fd, croppedData);
                    break;
                }
                fs.writeSync(fd, sector);
                size -= 512;
            }
            fs.closeSync(fd);
            continue;
        }
    }
    fs.closeSync(tar_fd);
}
module.exports = extract;