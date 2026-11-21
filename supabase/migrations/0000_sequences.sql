-- Run first. Sequences must exist before the tables whose defaults use them.
create sequence if not exists tx_ref_seq;
create sequence if not exists asg_ref_seq;
create sequence if not exists dsp_ref_seq;
