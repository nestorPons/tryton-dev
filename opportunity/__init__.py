# This file is part of Tryton.  The COPYRIGHT file at the top level of
# this repository contains the full copyright notices and license terms.

from trytond.pool import Pool
from . import opportunity
from . import party

__all__ = ['register']

def register():
    Pool.register(
        opportunity.Opportunity,
        opportunity.ConvertStart,
        party.Party,
        opportunity.OpportunityMonthly,
        module='opportunity', type_='model')
    Pool.register(
        opportunity.Convert,
        module='opportunity', type_='wizard')
    Pool.register(
        opportunity.OpportunityReport,
        module='opportunity', type_='report')
