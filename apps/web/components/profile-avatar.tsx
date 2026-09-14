"use client";

import { useState } from "react";
import type { ChatUser } from "./profile-provider";
import { UiIcon } from "./ui-icons";

/** Circular account photo with an icon fallback for guests and unavailable images. */
export function ProfileAvatar({ user }: { user: ChatUser | null | undefined }) {
  const [failedImage, setFailedImage] = useState("");
  const src = user?.avatar;
  return <span className="profile-avatar" aria-hidden="true">
    {src && src !== failedImage
      ? <img src={src} alt="" width="32" height="32" referrerPolicy="no-referrer" onError={() => setFailedImage(src)} />
      : <UiIcon name="user" />}
  </span>;
}
