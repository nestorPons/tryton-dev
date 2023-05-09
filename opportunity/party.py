from trytond.model import fields
from trytond.pool import PoolMeta

class Party(metaclass=PoolMeta):
    __name__ = 'party.party'
    opportunities = fields.One2Many(
        'training.opportunity', 'party', "Opportunities")