import pkgutil
installed = [m.name for m in pkgutil.iter_modules()]
print("Has playwright:", "playwright" in installed)
print("Has selenium:", "selenium" in installed)
