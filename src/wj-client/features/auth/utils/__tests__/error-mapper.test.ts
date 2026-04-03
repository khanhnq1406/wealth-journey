import {
  mapRegisterError,
  mapLinkPasswordError,
  mapChangePasswordError,
  mapLinkGoogleError,
  mapUnlinkGoogleError,
} from "../error-mapper";

describe("mapRegisterError", () => {
  it("maps known errors", () => {
    expect(mapRegisterError("username is required")).toBe("usernameRequired");
    expect(mapRegisterError("username must be at least 3 characters")).toBe(
      "usernameMinLength"
    );
  });
  it("returns null for unknown errors", () => {
    expect(mapRegisterError("some unknown error")).toBeNull();
  });
  it("returns null for undefined", () => {
    expect(mapRegisterError(undefined)).toBeNull();
  });
});

describe("mapLinkPasswordError", () => {
  it("maps known errors", () => {
    expect(
      mapLinkPasswordError("password already set for this account")
    ).toBe("passwordAlreadySet");
  });
  it("returns null for unknown errors", () => {
    expect(mapLinkPasswordError("unknown")).toBeNull();
  });
});

describe("mapChangePasswordError", () => {
  it("maps known errors", () => {
    expect(mapChangePasswordError("current password is incorrect")).toBe(
      "currentPasswordIncorrect"
    );
  });
  it("returns null for unknown errors", () => {
    expect(mapChangePasswordError("unknown")).toBeNull();
  });
});

describe("mapLinkGoogleError", () => {
  it("maps known errors", () => {
    expect(mapLinkGoogleError("google account is already linked")).toBe(
      "googleAlreadyLinked"
    );
  });
  it("returns null for unknown errors", () => {
    expect(mapLinkGoogleError("unknown")).toBeNull();
  });
});

describe("mapUnlinkGoogleError", () => {
  it('maps "google account is not linked" to googleNotLinked', () => {
    expect(mapUnlinkGoogleError("Google account is not linked")).toBe(
      "googleNotLinked"
    );
  });
  it('maps "please set a password before disconnecting google" to disconnectRequiresPassword', () => {
    expect(
      mapUnlinkGoogleError(
        "Please set a password before disconnecting Google"
      )
    ).toBe("disconnectRequiresPassword");
  });
  it("returns null for unknown errors", () => {
    expect(mapUnlinkGoogleError("some unknown error")).toBeNull();
  });
  it("returns null for undefined", () => {
    expect(mapUnlinkGoogleError(undefined)).toBeNull();
  });
});
