"""Strict offline OAS 3.1 validation, including eager local JSON Pointer checks."""
from openapi_spec_validator import validate
from jsonschema import Draft202012Validator


def validate_spec(spec):
    def visit(node):
        if isinstance(node, dict):
            if '$ref' in node:
                ref = node['$ref']
                if not ref.startswith('#/'):
                    raise ValueError('contract must be self-contained for offline validation: '+ref)
                target = spec
                for token in ref[2:].split('/'):
                    target = target[token.replace('~1','/').replace('~0','~')]
            for value in node.values():
                visit(value)
        elif isinstance(node,list):
            for value in node:
                visit(value)
    visit(spec)
    validate(spec)
    for schema in spec.get('components',{}).get('schemas',{}).values():
        Draft202012Validator.check_schema(schema)
