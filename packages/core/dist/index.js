"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAssociatedTokenAccountInstruction = exports.getAssociatedTokenAddress = exports.TOKEN_PROGRAM_ID = exports.SystemProgram = exports.Transaction = exports.Connection = exports.PublicKey = void 0;
// Core types and interfaces
__exportStar(require("./types"), exports);
// Utility functions
__exportStar(require("./utils"), exports);
// Re-export commonly used Solana types
var web3_js_1 = require("@solana/web3.js");
Object.defineProperty(exports, "PublicKey", { enumerable: true, get: function () { return web3_js_1.PublicKey; } });
Object.defineProperty(exports, "Connection", { enumerable: true, get: function () { return web3_js_1.Connection; } });
Object.defineProperty(exports, "Transaction", { enumerable: true, get: function () { return web3_js_1.Transaction; } });
Object.defineProperty(exports, "SystemProgram", { enumerable: true, get: function () { return web3_js_1.SystemProgram; } });
var spl_token_1 = require("@solana/spl-token");
Object.defineProperty(exports, "TOKEN_PROGRAM_ID", { enumerable: true, get: function () { return spl_token_1.TOKEN_PROGRAM_ID; } });
Object.defineProperty(exports, "getAssociatedTokenAddress", { enumerable: true, get: function () { return spl_token_1.getAssociatedTokenAddress; } });
Object.defineProperty(exports, "createAssociatedTokenAccountInstruction", { enumerable: true, get: function () { return spl_token_1.createAssociatedTokenAccountInstruction; } });
//# sourceMappingURL=index.js.map