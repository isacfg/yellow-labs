import { useState, useRef, useCallback } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import {
    ArrowLeft,
    Camera,
    Check,
    LogOut,
    Pencil,
    Trash2,
    User,
    Loader2,
} from "lucide-react";

function LogoMark() {
    return (
        <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl gradient-coral flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-white text-xs font-bold tracking-tight">S</span>
            </div>
            <span className="font-semibold text-base tracking-tight text-text-primary">
                Slides AI
            </span>
        </div>
    );
}

export function Settings() {
    const user = useQuery(api.users.viewer);
    const generateUploadUrl = useMutation(api.users.generateUploadUrl);
    const updateProfile = useMutation(api.users.updateProfile);
    const deleteProfileImage = useMutation(api.users.deleteProfileImage);
    const { signOut } = useAuthActions();
    const { isLoading, isAuthenticated } = useConvexAuth();
    const navigate = useNavigate();

    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState("");
    const [uploading, setUploading] = useState(false);
    const [savingName, setSavingName] = useState(false);
    const [deletingImage, setDeletingImage] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showToast = useCallback(
        (message: string, type: "success" | "error" = "success") => {
            setToast({ message, type });
            setTimeout(() => setToast(null), 3000);
        },
        []
    );

    const handleSignOut = async () => {
        await signOut();
        navigate("/", { replace: true });
    };

    const handleStartEditName = () => {
        setNameValue(user?.name || "");
        setEditingName(true);
    };

    const handleSaveName = async () => {
        if (!nameValue.trim()) return;
        setSavingName(true);
        try {
            await updateProfile({ name: nameValue.trim() });
            setEditingName(false);
            showToast("Name updated successfully");
        } catch {
            showToast("Failed to update name", "error");
        } finally {
            setSavingName(false);
        }
    };

    const handlePhotoUpload = useCallback(async (file: File) => {
        // Validate file type
        if (!file.type.startsWith("image/")) {
            showToast("Please select an image file", "error");
            return;
        }
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            showToast("Image must be under 5MB", "error");
            return;
        }

        setUploading(true);
        try {
            // Step 1: Get upload URL from Convex
            const uploadUrl = await generateUploadUrl();
            // Step 2: Upload the file
            const result = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
            const json = await result.json();
            const storageId = json.storageId;
            if (!storageId) {
                throw new Error(`Upload response missing storageId: ${JSON.stringify(json)}`);
            }
            // Step 3: Update user profile with the storage ID
            await updateProfile({ profileImageId: storageId });
            showToast("Photo updated successfully");
        } catch (err) {
            console.error("Photo upload failed:", err);
            showToast("Failed to upload photo", "error");
        } finally {
            setUploading(false);
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [generateUploadUrl, updateProfile, showToast]);

    // Callback ref: attaches a native 'change' event listener when the element mounts.
    // This guarantees the handler works even after early-return loading guards,
    // and also fires for programmatic events dispatched in e2e tests.
    const fileInputCallbackRef = useCallback(
        (node: HTMLInputElement | null) => {
            // Store it so we can still call node.click() and node.value = ""
            fileInputRef.current = node;
            if (!node) return;
            node.addEventListener("change", () => {
                const file = node.files?.[0];
                if (file) handlePhotoUpload(file);
            });
        },
        [handlePhotoUpload]
    );

    const handleDeletePhoto = async () => {
        setDeletingImage(true);
        try {
            await deleteProfileImage();
            showToast("Photo removed");
        } catch {
            showToast("Failed to remove photo", "error");
        } finally {
            setDeletingImage(false);
        }
    };

    // Loading / auth guard
    if (isLoading || user === undefined || user === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="h-8 w-8 rounded-xl gradient-coral flex items-center justify-center animate-pulse">
                    <span className="text-white text-xs font-bold">S</span>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    const initials = user.name
        ? user.name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : user.email
            ? user.email[0].toUpperCase()
            : "?";

    return (
        <div className="min-h-screen bg-surface">
            {/* Header */}
            <header className="border-b border-border-light sticky top-0 bg-surface/80 backdrop-blur-xl z-10">
                <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
                    <Link to="/">
                        <LogoMark />
                    </Link>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-text-tertiary hidden sm:block">
                            {user.email}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSignOut}
                            className="gap-1.5 text-text-secondary"
                        >
                            <LogOut className="h-4 w-4" />
                            Sign out
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-6 sm:px-8 py-10">
                {/* Back link */}
                <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-8 group"
                >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                    Back to Dashboard
                </Link>

                <div className="animate-slide-up">
                    <h1 className="text-3xl font-bold tracking-tight mb-1">Settings</h1>
                    <p className="text-sm text-text-secondary mb-10">
                        Manage your profile and account preferences
                    </p>
                </div>

                {/* Profile Section */}
                <div className="bg-surface-elevated rounded-2xl border border-border-light shadow-card overflow-hidden animate-fade-in">
                    {/* Profile header gradient banner */}
                    <div className="h-28 sm:h-32 gradient-coral relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />
                        {/* Decorative circles */}
                        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10" />
                        <div className="absolute -bottom-12 -left-4 h-24 w-24 rounded-full bg-white/5" />
                    </div>

                    {/* Avatar area - overlapping the banner */}
                    <div className="px-6 sm:px-8 -mt-14 relative z-[1]">
                        <div className="flex items-end gap-5 mb-6">
                            {/* Avatar */}
                            <div className="relative group shrink-0">
                                <div
                                    className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border-4 border-surface-elevated shadow-card-hover overflow-hidden bg-surface flex items-center justify-center cursor-pointer transition-all duration-300 group-hover:shadow-glow-coral"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploading ? (
                                        <Loader2 className="h-8 w-8 text-coral animate-spin" />
                                    ) : user.profileImageUrl ? (
                                        <img
                                            src={user.profileImageUrl}
                                            alt="Profile"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-full w-full gradient-dark flex items-center justify-center">
                                            <span className="text-2xl sm:text-3xl font-bold text-white/90">
                                                {initials}
                                            </span>
                                        </div>
                                    )}

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center rounded-2xl">
                                        <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </div>
                                </div>

                                {/* Upload badge */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full gradient-coral shadow-glow-coral flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform"
                                    aria-label="Upload photo"
                                >
                                    <Camera className="h-3.5 w-3.5" />
                                </button>

                                <input
                                    ref={fileInputCallbackRef}
                                    type="file"
                                    accept="image/*"
                                    className="sr-only"
                                    id="photo-upload-input"
                                />
                            </div>

                            {/* Name + email beside avatar */}
                            <div className="pb-1 min-w-0">
                                <h2 className="text-xl sm:text-2xl font-bold truncate text-text-primary">
                                    {user.name || "Set your name"}
                                </h2>
                                <p className="text-sm text-text-tertiary truncate">
                                    {user.email}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Settings fields */}
                    <div className="px-6 sm:px-8 pb-6">
                        <div className="border-t border-border-light pt-6 space-y-0 divide-y divide-border-light">
                            {/* Name Field */}
                            <div className="py-5 first:pt-0" id="settings-name-field">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <User className="h-3 w-3" />
                                            Display Name
                                        </label>
                                        {editingName ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <input
                                                    type="text"
                                                    value={nameValue}
                                                    onChange={(e) => setNameValue(e.target.value)}
                                                    onKeyDown={(e) =>
                                                        e.key === "Enter" && handleSaveName()
                                                    }
                                                    className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-border bg-surface text-sm font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral transition-all"
                                                    placeholder="Your name"
                                                    autoFocus
                                                    id="settings-name-input"
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={handleSaveName}
                                                    disabled={!nameValue.trim() || savingName}
                                                    className="rounded-xl h-10 px-4 gap-1.5"
                                                    id="settings-save-name-btn"
                                                >
                                                    {savingName ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Check className="h-3.5 w-3.5" />
                                                    )}
                                                    Save
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditingName(false)}
                                                    className="rounded-xl h-10 px-3 text-text-secondary"
                                                    id="settings-cancel-name-btn"
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        ) : (
                                            <p className="text-sm font-medium text-text-primary">
                                                {user.name || (
                                                    <span className="text-text-tertiary italic">
                                                        Not set
                                                    </span>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    {!editingName && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleStartEditName}
                                            className="shrink-0 text-text-secondary hover:text-coral gap-1.5 rounded-xl"
                                            id="settings-edit-name-btn"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Edit
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Email Field (read-only) */}
                            <div className="py-5" id="settings-email-field">
                                <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <svg
                                        className="h-3 w-3"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                        />
                                    </svg>
                                    Email
                                </label>
                                <p className="text-sm font-medium text-text-primary">
                                    {user.email}
                                </p>
                            </div>

                            {/* Profile Photo Management */}
                            <div className="py-5" id="settings-photo-field">
                                <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <Camera className="h-3 w-3" />
                                    Profile Photo
                                </label>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="rounded-xl gap-1.5"
                                        id="settings-upload-photo-btn"
                                    >
                                        {uploading ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Camera className="h-3.5 w-3.5" />
                                        )}
                                        {user.profileImageUrl ? "Change photo" : "Upload photo"}
                                    </Button>
                                    {user.profileImageUrl && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleDeletePhoto}
                                            disabled={deletingImage}
                                            className="rounded-xl gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                                            id="settings-delete-photo-btn"
                                        >
                                            {deletingImage ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-3.5 w-3.5" />
                                            )}
                                            Remove photo
                                        </Button>
                                    )}
                                    <p className="text-xs text-text-tertiary w-full mt-1">
                                        JPG, PNG or GIF. Max 5MB.
                                    </p>
                                </div>
                            </div>

                            {/* Account Created */}
                            <div className="py-5" id="settings-created-field">
                                <label className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <svg
                                        className="h-3 w-3"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                        />
                                    </svg>
                                    Member Since
                                </label>
                                <p className="text-sm font-medium text-text-primary">
                                    {new Date(user._creationTime).toLocaleDateString("en-US", {
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="mt-8 bg-surface-elevated rounded-2xl border border-border-light shadow-card overflow-hidden animate-fade-in">
                    <div className="px-6 sm:px-8 py-6">
                        <h3 className="text-sm font-semibold text-text-primary mb-1">
                            Sign Out
                        </h3>
                        <p className="text-xs text-text-secondary mb-4">
                            Sign out of your account on this device.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSignOut}
                            className="rounded-xl gap-1.5 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                            id="settings-signout-btn"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                            Sign out
                        </Button>
                    </div>
                </div>
            </main>

            {/* Toast notification */}
            {toast && (
                <div
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-card-hover text-sm font-medium animate-slide-up ${toast.type === "success"
                        ? "bg-navy text-white"
                        : "bg-red-500 text-white"
                        }`}
                >
                    {toast.message}
                </div>
            )}
        </div>
    );
}
