"""M0-08 Media, draft, reuse, and blob contracts."""

COMMANDS = {
    'ListMedia',
    'UploadMedia',
    'StoreQuarantineBlob',
    'DownloadCleanBlob',
    'DownloadMedia',
    'ReuseMedia',
    'ListDrafts',
    'SaveDraft',
}

def extend(s, operation, obj, arr, enum, UUID, TEXT, UTC, VERSION):
    pass

def customize(entry, command, ref, VERSION):
    if command in COMMANDS:
        pass
