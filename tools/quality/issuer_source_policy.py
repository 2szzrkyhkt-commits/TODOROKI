"""Known corporate source cohort for audit transport, not a rights determination."""
import unicodedata
from urllib.parse import unquote, urlsplit


# Corporate/IR/CDN hosts reviewed in the 2026-11-22 article migration.
# Denial applies to the listed suffixes; a generic CDN parent is not listed.
NO_AUTOMATED_AUDIT_SUFFIXES = (
    'advantest.com', 'caterpillar.com', 'contents.xj-storage.jp',
    'coreweave.com', 'eir-parts.net', 'furukawaelectric.com',
    'global.toyota', 'gmo-pg.com', 'group.ntt', 'group.softbank',
    'honda-ir.swcms.net', 'inpex.com', 'internet.gmo', 'japanpost.jp',
    'jti.co.jp', 'ko5yqxb8d4.execute-api.ap-northeast-1.amazonaws.com',
    'mhi.com', 'microsoft.com', 'mmc.co.jp', 'mufg.jp', 'murata.com',
    'nintendo.co.jp', 'nvidia.com', 'nyk.com', 'ojiholdings.co.jp',
    'olympus.co.jp', 'openhouse-group.co.jp', 'rakuten.co.jp',
    'recruit-holdings.com', 'renesas.com', 'rohm.com', 'sk-kaken.co.jp',
    'smbc.co.jp', 'smm.co.jp', 'sony.com', 'srigroup.co.jp', 'starts.co.jp',
    'sumitomoelectric.com', 'suzuki.co.jp', 'taiheiyo-cement.co.jp',
    'terumo.co.jp', 'yamada-holdings.jp',
)
IR_MARKERS = {'ir', 'investor', 'investors', 'investor-relations',
              'investor_relations', 'investorrelations', 'ir-library',
              'ir_library', 'ir-news', 'ir_news', 'irnews'}
SOURCE_ATTRIBUTE = 'data-todoroki-source'
SOURCE_ROLE = 'issuer-ir'


def normalized_host(value):
    return unicodedata.normalize('NFKC', unquote(value)).lower().translate(
        str.maketrans('。．｡', '...')).rstrip('.')


def source_key(url):
    """Conservative host/path match for explicitly marked citations and redirects."""
    try:
        parsed = urlsplit(url)
        return normalized_host(parsed.hostname or ''), unquote(parsed.path or '/')
    except ValueError:
        return '', ''


def is_issuer_source(url, tagged_sources=()):
    host, path = source_key(url)
    return bool(host and (
        (host, path) in tagged_sources
        or any(host == suffix or host.endswith('.' + suffix)
               for suffix in NO_AUTOMATED_AUDIT_SUFFIXES)
        or IR_MARKERS.intersection(host.split('.'))
        or IR_MARKERS.intersection(path.lower().split('/'))
    ))
