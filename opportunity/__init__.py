# This file is part of Tryton.  The COPYRIGHT file at the top level of
# this repository contains the full copyright notices and license terms.

from trytond.pool import Pool
from . import opportunity

__all__ = ['register']


def register():
    Pool.register(
        opportunity.Opportunity,
        module='opportunity', type_='model')
    Pool.register(
        module='opportunity', type_='wizard')
    Pool.register(
        module='opportunity', type_='report')
