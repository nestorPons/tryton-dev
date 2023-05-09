from trytond.pool import Pool
from trytond.model import ModelSQL, ModelView, fields, Workflow
from trytond.wizard import Wizard, StateView, StateTransition, Button
from trytond.report import Report
import datetime as dt
from trytond.pyson import If, Bool, Eval

from sql import Literal
from sql.aggregate import Count, Min
from sql.functions import CurrentTimestamp, DateTrunc

class Opportunity(Workflow, ModelSQL, ModelView):
    "Opportunity"
    __name__ = 'training.opportunity'
    _rec_name = 'description'

    description = fields.Char("Description", required=True,
                              states={
                                  'readonly': Eval('state') != 'draft',
                              })
    start_date = fields.Date(
        "Start Date", required=True,
        states={
            'readonly': Eval('state') != 'draft'
        },
        domain=[
            If(Bool(Eval('end_date')),
                ('start_date', '<=', Eval('end_date')),
                ())])
    end_date = fields.Date(
        "End Date",
        states={
            'readonly': Eval('state') != 'draft',
            'required': Eval('state').in_(['converted']),
        },
        domain=[
            If(Bool(Eval('end_date')),
                ('end_date', '>=', Eval('start_date')),
                ())])
    party = fields.Many2One('party.party', "Party", required=True,
                            states={
                                'readonly': Eval('state') != 'draft',
                            })
    comment = fields.Text(
        "Comment",
        states={
            'readonly': Eval('state') != 'draft',
            'invisible': (
                (Eval('state') != 'draft') & ~Eval('comment')),
        })
    duration = fields.Function(fields.TimeDelta(
        "Duration"), 'on_change_with_duration')
    address = fields.Many2One('party.address', "Address",
                              domain=[
                                  ('party', '=', Eval('party')),
                              ], states={
                                  'readonly': Eval('state') != 'draft',
                              })
    state = fields.Selection([
        ('draft', "Draft"),
        ('converted', "Converted"),
        ('lost', "Lost"),
    ], "State",
        required=True, readonly=True, sort=False)

    @classmethod
    def __setup__(cls):
        super().__setup__()
        cls._transitions.update({
            ('draft', 'converted'),
            ('draft', 'lost'),
            ('lost', 'draft'),
            ('converted', 'draft')
        })
        cls._buttons.update({
            'convert': {
                'invisible': Eval('state') != 'draft',
                'depends': ['state'],
            },
            'lost': {
                'invisible': Eval('state') != 'draft',
                'depends': ['state'],
            },
            'reset': {
                'depends': ['state']
            }
        })

    @classmethod
    def default_state(cls):
        return 'draft'

    @classmethod
    @ModelView.button
    @Workflow.transition('converted')
    def convert(cls, opportunities, end_date=None):
        pool = Pool()
        Date = pool.get('ir.date')
        cls.write(opportunities, {
            'end_date': end_date or Date.today(),
        })

    @classmethod
    @ModelView.button
    @Workflow.transition('lost')
    def lost(cls, opportunities):
        cls.write(opportunities, {
            'end_date': None,
        })

    @classmethod
    @ModelView.button
    @Workflow.transition('draft')
    def reset(self, opportunities):
        return self.default_state()

    @classmethod
    def default_start_date(cls):
        pool = Pool()
        Date = pool.get('ir.date')
        return Date.today()

    @fields.depends('start_date')
    def on_change_with_end_date(self):
        if self.start_date:
            return self.start_date + dt.timedelta(days=3)

    @fields.depends('party', 'description', 'comment')
    def on_change_party(self):
        if self.party:
            if not self.description:
                self.description = self.party.rec_name
            if not self.comment:
                lines = []
                if self.party.phone:
                    lines.append("Tel: %s" % self.party.phone)
                if self.party.email:
                    lines.append("Mail: %s" % self.party.email)
                self.comment = '\n'.join(lines)

    @fields.depends('start_date', 'end_date')
    def on_change_with_duration(self, name=None):
        if self.start_date and self.end_date:
            return self.end_date - self.start_date
        return None

class ConvertStart(ModelView):
    "Convert Opportunities"
    __name__ = 'training.opportunity.convert.start'

    end_date = fields.Date("End Date", required=True)

class Convert(Wizard):
    "Convert Opportunities"
    __name__ = 'training.opportunity.convert'

    start = StateView(
        'training.opportunity.convert.start',
        'opportunity.opportunity_convert_start_view_form', [
            Button("Cancel", 'end', 'tryton-cancel'),
            Button("Convert", 'convert', 'tryton-ok', default=True),
            ])
    convert = StateTransition()

    def transition_convert(self):
        self.model.convert(self.records, self.start.end_date)
        return 'end'

class OpportunityReport(Report):
    __name__ = 'training.opportunity.report'

class OpportunityMonthly(ModelSQL, ModelView):
    "Opportunity Monthly"
    __name__ = 'training.opportunity.monthly'

    month = fields.Date("Month")
    converted = fields.Integer("Converted")
    lost = fields.Integer("Lost")

    @classmethod
    def table_query(cls):
        pool = Pool()
        Opportunity = pool.get('training.opportunity')
        opportunity = Opportunity.__table__()

        month = cls.month.sql_cast(
            DateTrunc('month', opportunity.end_date))
        query = opportunity.select(
            Literal(0).as_('create_uid'),
            CurrentTimestamp().as_('create_date'),
            Literal(None).as_('write_uid'),
            Literal(None).as_('write_date'),
            Min(opportunity.id).as_('id'),
            month.as_('month'),
            Count(
                Literal('*'),
                filter_=opportunity.state == 'converted').as_('converted'),
            Count(
                Literal('*'),
                filter_=opportunity.state == 'lost').as_('lost'),
            where=opportunity.state.in_(['converted', 'lost']),
            group_by=[month])
        return query