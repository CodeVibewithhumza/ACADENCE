from setuptools import setup, find_packages

setup(
    name="acadence",
    version="2.0.0",
    package_dir={"": "backend"},
    packages=find_packages(where="backend"),
)
